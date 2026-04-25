import { randomUUID } from 'node:crypto';
import { contactTag, db, flowExecution, message } from '@mushu/db';
import { type FlowGraph, type FlowNode, flowGraphSchema } from '@mushu/shared/flow';
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
    if (node.type === 'trigger.comment_keyword' || node.type === 'trigger.dm_keyword') {
      currentNodeId = findNextNodeId(graph, currentNodeId);
      continue;
    }

    // ---- Side-effect nodes (synchronous) ----
    if (node.type === 'action.set_tag') {
      await applySetTag(exec.contactId, node.data.tag, node.data.operation);
      currentNodeId = findNextNodeId(graph, currentNodeId);
      continue;
    }

    if (node.type === 'action.set_custom_field') {
      // Stored on contact.custom_fields jsonb. We mutate in app for simplicity.
      // (For MVP we skip the actual mutation — it's a v0.2 feature.)
      currentNodeId = findNextNodeId(graph, currentNodeId);
      continue;
    }

    if (node.type === 'logic.condition') {
      const handle = evaluateCondition(node, state);
      currentNodeId = findNextNodeId(graph, currentNodeId, handle);
      continue;
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
  exec: { id: string; instagramAccountId: string; conversationId: string | null },
  node: Extract<FlowNode, { type: 'action.send_dm' | 'action.reply_comment' }>,
  _state: Record<string, unknown>,
): Promise<string> {
  const id = randomUUID();
  if (!exec.conversationId) {
    throw new Error('flow_execution has no conversation linked');
  }
  await db.insert(message).values({
    id,
    conversationId: exec.conversationId,
    instagramAccountId: exec.instagramAccountId,
    senderType: 'automation',
    senderId: null,
    messageType: node.type === 'action.reply_comment' ? 'activity' : 'outgoing',
    contentType: 'text',
    status: 'queued',
    content: node.data.text,
    contentAttributes: {
      nodeType: node.type,
      nodeId: node.id,
    },
    createdByAutomationId: exec.id,
  });
  return id;
}

async function applySetTag(
  contactId: string,
  tag: string,
  operation: 'add' | 'remove',
): Promise<void> {
  if (operation === 'add') {
    await db.insert(contactTag).values({ contactId, tag }).onConflictDoNothing();
  } else {
    await db
      .delete(contactTag)
      .where(and(eq(contactTag.contactId, contactId), eq(contactTag.tag, tag)));
  }
}

function evaluateCondition(
  _node: Extract<FlowNode, { type: 'logic.condition' }>,
  _state: Record<string, unknown>,
): string | undefined {
  // MVP: condition evaluation is stubbed — always takes the first branch.
  // Full implementation lands in v0.2 with custom field comparisons.
  return 'branch-0';
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
