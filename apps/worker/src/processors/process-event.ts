import { randomUUID } from 'node:crypto';
import {
  contact,
  contactInbox,
  conversation,
  dbAdmin as db,
  flow,
  flowExecution,
  incomingEvent,
  instagramAccount,
  message,
  trigger,
} from '@mushu/db';
import { type FlowGraph, flowGraphSchema } from '@mushu/shared/flow';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { findNextNodeId } from '../lib/trigger-matcher.ts';
import { validateUserInput } from '../lib/validate-user-input.ts';
import {
  type ExecuteFlowJob,
  type SendMessageJob,
  executionQueue,
  messageQueue,
} from '../queues.ts';
import { matchKeywords } from '../lib/trigger-matcher.ts';

interface ProcessEventArgs {
  incomingEventId: string;
}

/**
 * Process one incoming_event row:
 *   1. Load the event, bail if already processed (idempotent)
 *   2. Resolve the IG account
 *   3. Build a uniform "match input" depending on event type
 *   4. Look up triggers (DB-indexed by account + type + post_id)
 *   5. For each matched trigger, get/create contact + conversation,
 *      record the inbound message, and create a flow_execution
 *   6. Mark the event processed
 */
export async function processEvent({ incomingEventId }: ProcessEventArgs): Promise<void> {
  const [event] = await db
    .select()
    .from(incomingEvent)
    .where(eq(incomingEvent.id, incomingEventId))
    .limit(1);

  if (!event) {
    console.warn(`[process-event] event ${incomingEventId} not found`);
    return;
  }
  if (event.processedAt) {
    return; // already processed
  }
  if (!event.instagramAccountId) {
    await markProcessed(incomingEventId, 'no instagram account match');
    return;
  }

  const [account] = await db
    .select()
    .from(instagramAccount)
    .where(eq(instagramAccount.id, event.instagramAccountId))
    .limit(1);

  if (!account) {
    await markProcessed(incomingEventId, 'instagram account deleted');
    return;
  }

  const payload = event.payload as Record<string, unknown>;
  const matchContext = extractMatchContext(event.type, payload);
  if (!matchContext) {
    await markProcessed(incomingEventId, 'unsupported event shape');
    return;
  }

  // Anti-echo: ignore events where the actor is the account itself.
  if (matchContext.actorIgsid === account.igUserId) {
    await markProcessed(incomingEventId, 'echo from own account');
    return;
  }

  // If this is a DM and the contact has an in-flight flow waiting on a reply
  // (ask_question), resume that flow with the user's input — don't try to
  // match new triggers. This handles the conversational data-collection case.
  if (matchContext.kind === 'dm') {
    const resumed = await tryResumeAwaitingFlow({
      account,
      matchContext,
      incomingEventId,
    });
    if (resumed) return;
  }

  // Get-or-create contact + contact_inbox + conversation. We need this BEFORE
  // looking up triggers because `trigger.first_dm` only fires when the contact
  // is brand new (no prior contact_inbox row for this IG account).
  const { contactId, contactInboxId, conversationId, isNewContact } =
    await ensureContactContext({
      organizationId: account.organizationId,
      instagramAccountId: account.id,
      actorIgsid: matchContext.actorIgsid,
      actorUsername: matchContext.actorUsername,
    });

  // Load eligible triggers via index. Story events are mutually exclusive
  // with regular DM triggers — a story reply only fires `story_reply`
  // triggers, never `dm_keyword`. For new-contact regular DMs, also pull
  // `first_dm` triggers (they fire alongside any matching dm_keyword).
  type TriggerType =
    | 'comment_keyword'
    | 'dm_keyword'
    | 'first_dm'
    | 'story_reply'
    | 'story_mention'
    | 'ref_url'
    | 'manual';
  const acceptedTypes: TriggerType[] =
    matchContext.kind === 'comment'
      ? ['comment_keyword']
      : matchContext.kind === 'story_reply'
        ? ['story_reply']
        : matchContext.kind === 'story_mention'
          ? ['story_mention']
          : isNewContact
            ? ['dm_keyword', 'first_dm']
            : ['dm_keyword'];

  const triggerRows = await db
    .select({
      id: trigger.id,
      flowId: trigger.flowId,
      type: trigger.type,
      instagramPostId: trigger.instagramPostId,
      config: trigger.config,
    })
    .from(trigger)
    .where(
      and(
        eq(trigger.instagramAccountId, account.id),
        inArray(trigger.type, acceptedTypes),
        eq(trigger.isActive, true),
      ),
    );

  type Cfg = {
    keywords?: string[];
    matchMode?: 'exact' | 'contains' | 'starts_with' | 'any';
    caseSensitive?: boolean;
  };

  const matched = triggerRows.filter((t) => {
    // Config-less triggers — always match within their accepted-type window.
    if (t.type === 'first_dm' || t.type === 'story_reply' || t.type === 'story_mention') {
      return true;
    }
    if (matchContext.kind === 'comment' && t.instagramPostId && t.instagramPostId !== matchContext.postId) {
      return false;
    }
    const cfg = (t.config as Cfg | null) ?? {};
    return matchKeywords(
      matchContext.text,
      cfg.keywords ?? [],
      cfg.matchMode ?? 'contains',
      cfg.caseSensitive ?? false,
    );
  });

  if (matched.length === 0) {
    await markProcessed(incomingEventId, 'no trigger matched');
    return;
  }

  // Persist the inbound event as a message in the conversation (idempotent
  // via source_id unique).
  await db
    .insert(message)
    .values({
      id: randomUUID(),
      conversationId,
      instagramAccountId: account.id,
      organizationId: account.organizationId,
      senderType: 'contact',
      senderId: contactId,
      messageType: 'incoming',
      contentType: 'text',
      content: matchContext.text,
      sourceId: matchContext.sourceId,
    })
    .onConflictDoNothing();

  await db
    .update(conversation)
    .set({
      lastIncomingAt: new Date(),
      lastActivityAt: new Date(),
    })
    .where(eq(conversation.id, conversationId));

  // For each matched trigger: load flow, validate published graph, create
  // execution, enqueue execute-flow.
  for (const t of matched) {
    const [flowRow] = await db
      .select({
        id: flow.id,
        publishVersion: flow.publishVersion,
        publishedGraph: flow.publishedGraph,
        isEnabled: flow.isEnabled,
      })
      .from(flow)
      .where(eq(flow.id, t.flowId))
      .limit(1);

    if (!flowRow || !flowRow.isEnabled || !flowRow.publishedGraph) {
      continue;
    }

    const parsed = flowGraphSchema.safeParse(flowRow.publishedGraph);
    if (!parsed.success) {
      console.error(`[process-event] flow ${flowRow.id} graph invalid:`, parsed.error.message);
      continue;
    }
    const graph: FlowGraph = parsed.data;

    // Determine starting node: the trigger node in the graph (matched by id
    // recorded in the trigger row, or we re-match by data shape if no id).
    // For MVP we re-match by node type + post_id + keywords.
    const startNode = findStartNodeForTrigger(graph, matchContext, t.type);
    if (!startNode) {
      console.warn(`[process-event] flow ${flowRow.id}: trigger node not found in graph`);
      continue;
    }

    const executionId = randomUUID();
    await db.insert(flowExecution).values({
      id: executionId,
      flowId: flowRow.id,
      flowPublishVersion: flowRow.publishVersion,
      triggerId: t.id,
      organizationId: account.organizationId,
      instagramAccountId: account.id,
      contactId,
      conversationId,
      currentNodeId: startNode.id,
      visitedNodes: [startNode.id],
      state: {
        triggerSourceId: matchContext.sourceId,
        triggerCommentId: matchContext.kind === 'comment' ? matchContext.sourceId : null,
      },
      graphSnapshot: graph,
      status: 'active',
    });

    const job: ExecuteFlowJob = { flowExecutionId: executionId };
    await executionQueue.add('execute', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
  }

  await markProcessed(incomingEventId, null);
}

interface MatchContext {
  kind: 'comment' | 'dm' | 'story_reply' | 'story_mention';
  text: string;
  actorIgsid: string;
  actorUsername: string | null;
  postId: string | null;
  sourceId: string;
}

function extractMatchContext(
  type: string,
  payload: Record<string, unknown>,
): MatchContext | null {
  if (type === 'comment') {
    const change = (payload as { change?: { value?: Record<string, unknown> } }).change;
    const value = change?.value;
    if (!value) return null;
    const from = value.from as { id?: string; username?: string } | undefined;
    const media = value.media as { id?: string } | undefined;
    if (!from?.id || !media?.id || !value.id) return null;
    return {
      kind: 'comment',
      text: typeof value.text === 'string' ? value.text : '',
      actorIgsid: from.id,
      actorUsername: from.username ?? null,
      postId: media.id,
      sourceId: String(value.id),
    };
  }
  if (type === 'message' || type === 'story_reply' || type === 'story_mention') {
    const messaging = (payload as { messaging?: Record<string, unknown> }).messaging;
    if (!messaging) return null;
    const sender = messaging.sender as { id?: string } | undefined;
    const msg = messaging.message as { mid?: string; text?: string } | undefined;
    if (!sender?.id) return null;
    // Regular DMs require a text body; story mentions often arrive with no
    // text (just the attachment), so we accept empty text for those.
    if (type === 'message' && !msg?.text) return null;
    const kind: MatchContext['kind'] =
      type === 'story_reply' ? 'story_reply' : type === 'story_mention' ? 'story_mention' : 'dm';
    return {
      kind,
      text: msg?.text ?? '',
      actorIgsid: sender.id,
      actorUsername: null,
      postId: null,
      sourceId: msg?.mid ?? `${kind}:${Date.now()}`,
    };
  }
  return null;
}

async function ensureContactContext(args: {
  organizationId: string;
  instagramAccountId: string;
  actorIgsid: string;
  actorUsername: string | null;
}): Promise<{
  contactId: string;
  contactInboxId: string;
  conversationId: string;
  /** True when we just created the contact_inbox row in this call. */
  isNewContact: boolean;
}> {
  // contact_inbox is the natural lookup since source_id is unique per
  // instagram_account.
  const [existingInbox] = await db
    .select()
    .from(contactInbox)
    .where(
      and(
        eq(contactInbox.instagramAccountId, args.instagramAccountId),
        eq(contactInbox.sourceId, args.actorIgsid),
      ),
    )
    .limit(1);

  let contactId: string;
  let contactInboxId: string;
  const isNewContact = !existingInbox;

  if (existingInbox) {
    contactId = existingInbox.contactId;
    contactInboxId = existingInbox.id;
    if (args.actorUsername && args.actorUsername !== existingInbox.igUsername) {
      await db
        .update(contactInbox)
        .set({ igUsername: args.actorUsername, updatedAt: new Date() })
        .where(eq(contactInbox.id, existingInbox.id));
    }
  } else {
    contactId = randomUUID();
    contactInboxId = randomUUID();
    await db.insert(contact).values({
      id: contactId,
      organizationId: args.organizationId,
      name: args.actorUsername,
    });
    await db.insert(contactInbox).values({
      id: contactInboxId,
      contactId,
      instagramAccountId: args.instagramAccountId,
      organizationId: args.organizationId,
      sourceId: args.actorIgsid,
      igUsername: args.actorUsername,
    });
  }

  // For now: 1 conversation per contact_inbox (we don't model "session
  // closure" yet — that's v0.3 inbox work).
  const [existingConv] = await db
    .select({ id: conversation.id })
    .from(conversation)
    .where(eq(conversation.contactInboxId, contactInboxId))
    .limit(1);

  let conversationId: string;
  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    conversationId = randomUUID();
    await db.insert(conversation).values({
      id: conversationId,
      organizationId: args.organizationId,
      instagramAccountId: args.instagramAccountId,
      contactInboxId,
      contactId,
      status: 'pending',
    });
  }

  return { contactId, contactInboxId, conversationId, isNewContact };
}

/**
 * If a flow is currently `awaiting_input` for this contact, treat the inbound
 * DM as the answer: validate, store the variable, advance the cursor, and
 * re-enqueue execution. Returns true if it handled the event (caller should
 * skip normal trigger matching).
 *
 * On invalid input, sends the fallback prompt and bumps the attempt counter
 * — only gives up after maxAttempts.
 */
async function tryResumeAwaitingFlow(args: {
  account: { id: string; organizationId: string };
  matchContext: MatchContext;
  incomingEventId: string;
}): Promise<boolean> {
  const { account, matchContext, incomingEventId } = args;

  const [inbox] = await db
    .select({ contactId: contactInbox.contactId, conversationId: conversation.id })
    .from(contactInbox)
    .leftJoin(conversation, eq(conversation.contactInboxId, contactInbox.id))
    .where(
      and(
        eq(contactInbox.instagramAccountId, account.id),
        eq(contactInbox.sourceId, matchContext.actorIgsid),
      ),
    )
    .limit(1);

  if (!inbox) return false;

  const [exec] = await db
    .select()
    .from(flowExecution)
    .where(
      and(
        eq(flowExecution.contactId, inbox.contactId),
        eq(flowExecution.status, 'awaiting_input'),
      ),
    )
    .orderBy(desc(flowExecution.updatedAt))
    .limit(1);

  if (!exec) return false;

  const state = (exec.state as Record<string, unknown>) ?? {};
  const awaitingFor = state.awaitingFor as
    | {
        variableName: string;
        inputType: 'text' | 'email' | 'number' | 'phone';
        fallbackText: string | null;
        maxAttempts: number;
        attempts: number;
      }
    | undefined;

  if (!awaitingFor) {
    // Inconsistent state — clear the wait flag and fall through to triggers.
    await db
      .update(flowExecution)
      .set({ status: 'cancelled', errorMessage: 'awaiting_input without awaitingFor' })
      .where(eq(flowExecution.id, exec.id));
    return false;
  }

  // Persist the inbound message in the conversation either way.
  if (inbox.conversationId) {
    await db
      .insert(message)
      .values({
        id: randomUUID(),
        conversationId: inbox.conversationId,
        instagramAccountId: account.id,
        organizationId: account.organizationId,
        senderType: 'contact',
        senderId: inbox.contactId,
        messageType: 'incoming',
        contentType: 'text',
        content: matchContext.text,
        sourceId: matchContext.sourceId,
      })
      .onConflictDoNothing();
  }

  const parsed = validateUserInput(matchContext.text, awaitingFor.inputType);

  if (parsed === null) {
    // Invalid: bump attempts, resend fallback if still allowed, else cancel.
    const nextAttempts = awaitingFor.attempts + 1;
    if (nextAttempts >= awaitingFor.maxAttempts) {
      await db
        .update(flowExecution)
        .set({
          status: 'cancelled',
          errorMessage: 'max_invalid_attempts',
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(flowExecution.id, exec.id));
    } else {
      const fallback =
        awaitingFor.fallbackText ?? defaultFallback(awaitingFor.inputType);
      if (inbox.conversationId) {
        const outId = randomUUID();
        await db.insert(message).values({
          id: outId,
          conversationId: inbox.conversationId,
          instagramAccountId: account.id,
          organizationId: account.organizationId,
          senderType: 'automation',
          senderId: null,
          messageType: 'outgoing',
          contentType: 'text',
          status: 'queued',
          content: fallback,
          contentAttributes: { reason: 'ask_question_fallback' },
          createdByAutomationId: exec.id,
        });
        const sendJob: SendMessageJob = {
          outgoingMessageId: outId,
          flowExecutionId: exec.id,
        };
        await messageQueue.add('send', sendJob, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
        });
      }
      const newState = {
        ...state,
        awaitingFor: { ...awaitingFor, attempts: nextAttempts },
      };
      await db
        .update(flowExecution)
        .set({ state: newState, updatedAt: new Date() })
        .where(eq(flowExecution.id, exec.id));
    }
    await markProcessed(incomingEventId, null);
    return true;
  }

  // Valid: persist into both transient state and the contact's customFields,
  // then advance the cursor and resume execution.
  const variables = (state.variables as Record<string, unknown>) ?? {};
  variables[awaitingFor.variableName] = parsed;

  await db
    .update(contact)
    .set({
      customFields: sql`${contact.customFields} || ${JSON.stringify({ [awaitingFor.variableName]: parsed })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(contact.id, inbox.contactId));

  const parsedGraph = flowGraphSchema.safeParse(exec.graphSnapshot);
  let nextNodeId: string | null = null;
  if (parsedGraph.success && exec.currentNodeId) {
    nextNodeId = findNextNodeId(parsedGraph.data, exec.currentNodeId);
  }

  const newState: Record<string, unknown> = {
    ...state,
    variables,
  };
  delete (newState as { awaitingFor?: unknown }).awaitingFor;

  await db
    .update(flowExecution)
    .set({
      status: 'active',
      currentNodeId: nextNodeId,
      state: newState,
      updatedAt: new Date(),
    })
    .where(eq(flowExecution.id, exec.id));

  const job: ExecuteFlowJob = { flowExecutionId: exec.id };
  await executionQueue.add('execute', job, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 1000,
  });

  await markProcessed(incomingEventId, null);
  return true;
}

function defaultFallback(inputType: 'text' | 'email' | 'number' | 'phone'): string {
  switch (inputType) {
    case 'email':
      return 'Hmm, isso não parece um e-mail. Pode mandar de novo no formato nome@dominio.com?';
    case 'number':
      return 'Não entendi o número. Pode escrever só dígitos? (ex: 30)';
    case 'phone':
      return 'Não consegui ler o telefone. Manda só os números, com DDD (ex: 11999999999)';
    default:
      return 'Pode escrever de outro jeito?';
  }
}

function findStartNodeForTrigger(
  graph: FlowGraph,
  ctx: MatchContext,
  triggerType: string,
) {
  return graph.nodes.find((n) => {
    if (triggerType === 'first_dm' && n.type === 'trigger.first_dm') {
      return true;
    }
    if (triggerType === 'story_reply' && n.type === 'trigger.story_reply') {
      return true;
    }
    if (triggerType === 'story_mention' && n.type === 'trigger.story_mention') {
      return true;
    }
    if (
      ctx.kind === 'comment' &&
      triggerType === 'comment_keyword' &&
      n.type === 'trigger.comment_keyword'
    ) {
      // null postId = wildcard (any post).
      return n.data.instagramPostId === null || n.data.instagramPostId === ctx.postId;
    }
    if (ctx.kind === 'dm' && triggerType === 'dm_keyword' && n.type === 'trigger.dm_keyword') {
      return true;
    }
    return false;
  });
}

async function markProcessed(eventId: string, errorMessage: string | null) {
  await db
    .update(incomingEvent)
    .set({
      processedAt: new Date(),
      errorMessage,
    })
    .where(eq(incomingEvent.id, eventId));
}

// Suppress unused import warning when sql isn't directly used.
void sql;
