import { randomUUID } from 'node:crypto';
import { contact, contactTag, dbAdmin as db, flowExecution, message } from '@mushu/db';
import {
  type FlowGraph,
  type FlowNode,
  flowGraphSchema,
  renderTemplate,
} from '@mushu/shared/flow';
import { and, eq, sql } from 'drizzle-orm';
import { type ExecuteFlowJob, type SendMessageJob, executionQueue, messageQueue } from '../queues.ts';
import { findNextNodeId, getNodeById } from '../lib/trigger-matcher.ts';

interface ExecuteFlowArgs {
  flowExecutionId: string;
}

const SAFETY_NODE_LIMIT = 100;

/**
 * Advance one flow_execution. Walks the graph synchronously until it hits a
 * blocking step (send action, delay, awaiting input) or the end.
 *
 * Concurrency safety:
 *   - Acquires `isReplying` lock atomically via conditional UPDATE.
 *   - If lock can't be acquired, the caller (BullMQ retry) will see the job
 *     fail and back off; another worker is mid-flight.
 *
 * Cycle safety:
 *   - Maintains `visitedNodes` set; refuses to re-enter a node it already
 *     visited within this execution. Catches misconfigured graphs and
 *     prevents infinite loops.
 */
export async function executeFlow({ flowExecutionId }: ExecuteFlowArgs): Promise<void> {
  // Acquire lock: only proceed if isReplying was false.
  const lockResult = await db
    .update(flowExecution)
    .set({ isReplying: true, updatedAt: new Date() })
    .where(and(eq(flowExecution.id, flowExecutionId), eq(flowExecution.isReplying, false)))
    .returning();

  if (lockResult.length === 0) {
    console.warn(`[execute-flow] ${flowExecutionId} is locked by another worker, skipping`);
    return;
  }
  const exec = lockResult[0];
  if (!exec) return;

  if (exec.status === 'done' || exec.status === 'failed' || exec.status === 'cancelled') {
    await releaseLock(flowExecutionId);
    return;
  }

  const parsedGraph = flowGraphSchema.safeParse(exec.graphSnapshot);
  if (!parsedGraph.success) {
    await failExecution(flowExecutionId, `invalid graph snapshot: ${parsedGraph.error.message}`);
    return;
  }
  const graph: FlowGraph = parsedGraph.data;

  const visited = new Set(((exec.visitedNodes as string[] | null) ?? []).map(String));
  let currentNodeId: string | null = exec.currentNodeId;
  const state = (exec.state as Record<string, unknown>) ?? {};
  let steps = 0;

  while (currentNodeId) {
    if (++steps > SAFETY_NODE_LIMIT) {
      await failExecution(flowExecutionId, `safety limit ${SAFETY_NODE_LIMIT} steps reached`);
      return;
    }

    const node = getNodeById(graph, currentNodeId);
    if (!node) {
      await failExecution(flowExecutionId, `node ${currentNodeId} not found in graph`);
      return;
    }

    // Cycle protection — only check after first iteration; the trigger node
    // is allowed to be in visited from the start.
    if (steps > 1 && visited.has(currentNodeId)) {
      await failExecution(flowExecutionId, `cycle detected at node ${currentNodeId}`);
      return;
    }
    visited.add(currentNodeId);

    // ---- Terminal ----
    if (node.type === 'control.end') {
      await db
        .update(flowExecution)
        .set({
          status: 'done',
          isReplying: false,
          finishedAt: new Date(),
          currentNodeId,
          visitedNodes: [...visited],
          state,
          updatedAt: new Date(),
        })
        .where(eq(flowExecution.id, flowExecutionId));
      return;
    }

    // ---- Trigger nodes are entry points; just walk past them ----
    if (
      node.type === 'trigger.comment_keyword' ||
      node.type === 'trigger.dm_keyword' ||
      node.type === 'trigger.first_dm' ||
      node.type === 'trigger.story_reply' ||
      node.type === 'trigger.story_mention'
    ) {
      currentNodeId = findNextNodeId(graph, currentNodeId);
      continue;
    }

    // ---- Side-effect nodes (synchronous) ----
    if (node.type === 'action.set_tag') {
      await applySetTag(exec.contactId, exec.organizationId, node.data.tag, node.data.operation);
      currentNodeId = findNextNodeId(graph, currentNodeId);
      continue;
    }

    if (node.type === 'action.set_custom_field') {
      await applySetCustomField(exec.contactId, node.data.field, node.data.value);
      // Mirror into in-flight state so subsequent {{var}} substitutions in
      // the same execution see the new value without a re-fetch.
      const variables = (state.variables as Record<string, unknown>) ?? {};
      variables[node.data.field] = node.data.value;
      state.variables = variables;
      currentNodeId = findNextNodeId(graph, currentNodeId);
      continue;
    }

    if (node.type === 'logic.condition') {
      const handle = await evaluateCondition(node, state, exec.contactId);
      currentNodeId = findNextNodeId(graph, currentNodeId, handle);
      continue;
    }

    if (node.type === 'action.ask_question') {
      // Send the question DM, then pause execution awaiting the user's reply.
      // process-event picks the reply up via flowExecution.status='awaiting_input'.
      const renderedQuestion = renderTemplate(node.data.questionText, {
        variables: (state.variables as Record<string, unknown>) ?? {},
        customFields: await fetchContactCustomFields(exec.contactId),
      });
      const outgoingId = await persistOutgoingTextMessage(
        exec,
        renderedQuestion,
        node.id,
        'action.send_dm',
      );
      const sendJob: SendMessageJob = { outgoingMessageId: outgoingId, flowExecutionId };
      await messageQueue.add('send', sendJob, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
      });

      const newState = {
        ...state,
        awaitingFor: {
          variableName: node.data.variableName,
          inputType: node.data.inputType,
          fallbackText: node.data.fallbackText ?? null,
          maxAttempts: node.data.maxAttempts,
          attempts: 0,
        },
      };
      await db
        .update(flowExecution)
        .set({
          status: 'awaiting_input',
          isReplying: false,
          currentNodeId,
          visitedNodes: [...visited],
          state: newState,
          updatedAt: new Date(),
        })
        .where(eq(flowExecution.id, flowExecutionId));
      return;
    }

    // ---- Blocking steps: enqueue work and save state ----
    if (node.type === 'logic.delay') {
      const wakeAt = new Date(Date.now() + node.data.durationSeconds * 1000);
      await db
        .update(flowExecution)
        .set({
          status: 'waiting',
          isReplying: false,
          wakeAt,
          currentNodeId,
          visitedNodes: [...visited],
          state,
          updatedAt: new Date(),
        })
        .where(eq(flowExecution.id, flowExecutionId));
      // After delay, advance one node so the next execution starts on what
      // comes AFTER the delay. We do that before scheduling the wake-up.
      const next = findNextNodeId(graph, currentNodeId);
      await db
        .update(flowExecution)
        .set({ currentNodeId: next })
        .where(eq(flowExecution.id, flowExecutionId));
      const job: ExecuteFlowJob = { flowExecutionId };
      await executionQueue.add('execute', job, {
        delay: node.data.durationSeconds * 1000,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
      });
      return;
    }

    if (node.type === 'action.send_dm' || node.type === 'action.reply_comment') {
      const outgoingId = await persistOutgoingMessage(exec, node, state);
      const job: SendMessageJob = {
        outgoingMessageId: outgoingId,
        flowExecutionId,
      };
      await messageQueue.add('send', job, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
      });
      // Stay on this node; send-message will advance currentNodeId on success.
      await db
        .update(flowExecution)
        .set({
          status: 'active',
          isReplying: false,
          currentNodeId,
          visitedNodes: [...visited],
          state,
          updatedAt: new Date(),
        })
        .where(eq(flowExecution.id, flowExecutionId));
      return;
    }

    // Unknown node type — advance past it.
    console.warn(`[execute-flow] unknown node type, skipping`);
    currentNodeId = findNextNodeId(graph, currentNodeId);
  }

  // Walked off the end of the graph without an explicit End node.
  await db
    .update(flowExecution)
    .set({
      status: 'done',
      isReplying: false,
      finishedAt: new Date(),
      currentNodeId,
      visitedNodes: [...visited],
      state,
      updatedAt: new Date(),
    })
    .where(eq(flowExecution.id, flowExecutionId));
}

async function persistOutgoingMessage(
  exec: {
    id: string;
    instagramAccountId: string;
    conversationId: string | null;
    contactId: string;
    organizationId: string;
  },
  node: Extract<FlowNode, { type: 'action.send_dm' | 'action.reply_comment' }>,
  state: Record<string, unknown>,
): Promise<string> {
  const customFields = await fetchContactCustomFields(exec.contactId);
  const rendered = renderTemplate(node.data.text, {
    variables: (state.variables as Record<string, unknown>) ?? {},
    customFields,
  });
  // quick_replies are attached to send_dm only — reply_comment is a public
  // comment which can't have buttons. Filter blanks defensively.
  const quickReplies =
    node.type === 'action.send_dm'
      ? (node.data.quickReplies ?? []).map((s) => s.trim()).filter(Boolean)
      : [];
  return persistOutgoingTextMessage(
    exec,
    rendered,
    node.id,
    node.type,
    quickReplies.length > 0 ? quickReplies : undefined,
  );
}

async function persistOutgoingTextMessage(
  exec: {
    id: string;
    instagramAccountId: string;
    conversationId: string | null;
    organizationId: string;
  },
  text: string,
  nodeId: string,
  nodeType: 'action.send_dm' | 'action.reply_comment',
  quickReplies?: string[],
): Promise<string> {
  const id = randomUUID();
  if (!exec.conversationId) {
    throw new Error('flow_execution has no conversation linked');
  }
  await db.insert(message).values({
    id,
    conversationId: exec.conversationId,
    instagramAccountId: exec.instagramAccountId,
    organizationId: exec.organizationId,
    senderType: 'automation',
    senderId: null,
    messageType: nodeType === 'action.reply_comment' ? 'activity' : 'outgoing',
    contentType: 'text',
    status: 'queued',
    content: text,
    contentAttributes: {
      nodeType,
      nodeId,
      ...(quickReplies && quickReplies.length > 0 ? { quickReplies } : {}),
    },
    createdByAutomationId: exec.id,
  });
  return id;
}

async function fetchContactCustomFields(contactId: string): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ customFields: contact.customFields })
    .from(contact)
    .where(eq(contact.id, contactId))
    .limit(1);
  return ((row?.customFields as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
}

async function applySetTag(
  contactId: string,
  organizationId: string,
  tag: string,
  operation: 'add' | 'remove',
): Promise<void> {
  if (operation === 'add') {
    await db
      .insert(contactTag)
      .values({ contactId, organizationId, tag })
      .onConflictDoNothing();
  } else {
    await db
      .delete(contactTag)
      .where(and(eq(contactTag.contactId, contactId), eq(contactTag.tag, tag)));
  }
}

async function applySetCustomField(
  contactId: string,
  field: string,
  value: string | number | boolean,
): Promise<void> {
  // Merge into the existing jsonb. `||` on jsonb in Postgres is a shallow merge.
  await db
    .update(contact)
    .set({
      customFields: sql`${contact.customFields} || ${JSON.stringify({ [field]: value })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(contact.id, contactId));
}

type ConditionNode = Extract<FlowNode, { type: 'logic.condition' }>;
type ConditionLeaf = ConditionNode['data']['branches'][number]['conditions'][number];

/**
 * Walks each branch in order; returns 'branch-N' for the first branch whose
 * conditions all (AND) or any (OR) match. Falls back to the LAST branch if
 * nothing matches — that's the "default/else" by convention.
 */
async function evaluateCondition(
  node: ConditionNode,
  state: Record<string, unknown>,
  contactId: string,
): Promise<string> {
  const variables = (state.variables as Record<string, unknown> | undefined) ?? {};
  const customFields = await fetchContactCustomFields(contactId);
  const tagSet = await fetchContactTags(contactId);

  for (let i = 0; i < node.data.branches.length; i++) {
    const branch = node.data.branches[i]!;
    const results = await Promise.all(
      branch.conditions.map((c) => evalLeaf(c, variables, customFields, tagSet)),
    );
    if (results.length === 0) continue;
    const passes = branch.logical === 'or' ? results.some(Boolean) : results.every(Boolean);
    if (passes) return `branch-${i}`;
  }
  return `branch-${node.data.branches.length - 1}`;
}

async function fetchContactTags(contactId: string): Promise<Set<string>> {
  const rows = await db
    .select({ tag: contactTag.tag })
    .from(contactTag)
    .where(eq(contactTag.contactId, contactId));
  return new Set(rows.map((r) => r.tag));
}

function evalLeaf(
  c: ConditionLeaf,
  variables: Record<string, unknown>,
  customFields: Record<string, unknown>,
  tagSet: Set<string>,
): boolean {
  if (c.operator === 'has_tag') return tagSet.has(String(c.value ?? ''));
  if (c.operator === 'not_has_tag') return !tagSet.has(String(c.value ?? ''));

  // Resolve field from variables first, falling back to persistent custom fields.
  const fieldValue =
    variables[c.field] !== undefined ? variables[c.field] : customFields[c.field];

  if (c.operator === 'is_set') {
    return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
  }
  if (c.operator === 'is_empty') {
    return fieldValue === undefined || fieldValue === null || fieldValue === '';
  }

  const expected = c.value;
  if (c.operator === 'equals') return String(fieldValue) === String(expected);
  if (c.operator === 'not_equals') return String(fieldValue) !== String(expected);
  if (c.operator === 'contains') {
    return String(fieldValue ?? '')
      .toLowerCase()
      .includes(String(expected ?? '').toLowerCase());
  }
  if (c.operator === 'starts_with') {
    return String(fieldValue ?? '')
      .toLowerCase()
      .startsWith(String(expected ?? '').toLowerCase());
  }
  if (c.operator === 'gt') return Number(fieldValue) > Number(expected);
  if (c.operator === 'lt') return Number(fieldValue) < Number(expected);
  return false;
}

async function releaseLock(executionId: string): Promise<void> {
  await db
    .update(flowExecution)
    .set({ isReplying: false, updatedAt: new Date() })
    .where(eq(flowExecution.id, executionId));
}

async function failExecution(executionId: string, reason: string): Promise<void> {
  console.error(`[execute-flow] ${executionId} failed: ${reason}`);
  await db
    .update(flowExecution)
    .set({
      status: 'failed',
      isReplying: false,
      errorMessage: reason,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(flowExecution.id, executionId));
}

void sql;
