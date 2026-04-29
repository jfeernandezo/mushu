import {
  contactInbox,
  conversation,
  dbAdmin as db,
  flow,
  flowExecution,
  instagramAccount,
  message,
} from '@mushu/db';
import { type FlowGraph, flowGraphSchema } from '@mushu/shared/flow';
import { createLogger } from '@mushu/shared/logger';
import { eq } from 'drizzle-orm';
import { type ExecuteFlowJob, executionQueue } from '../queues.ts';
import { connection } from '../queues.ts';
import { publishInboxEvent } from '../lib/inbox-broadcast.ts';
import { createChannelClient } from '../lib/channel-client.ts';
import { IgError } from '../lib/instagram-client.ts';
import { RateLimiter } from '../lib/rate-limiter.ts';
import { findNextNodeId, getNodeById } from '../lib/trigger-matcher.ts';

const logger = createLogger('worker.send-message');
const rateLimiter = new RateLimiter(connection);
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface SendMessageArgs {
  outgoingMessageId: string;
  flowExecutionId: string;
}

/**
 * Send one outgoing message via Graph API.
 *
 * Pre-flight checks:
 *   1. Rate limit per IG account (Redis token bucket, 180/h)
 *   2. 24-hour messaging window (Meta restriction):
 *      - For reply_comment: never blocked
 *      - For first DM after comment: use sendDmByCommentId (in-thread)
 *      - For subsequent DMs: must have conversation.lastIncomingAt within 24h
 *
 * On success: advance the flow_execution past this node and enqueue
 * execute-flow to continue. On classified error: mark message failed and
 * either retry (transient/rate_limit) or fail the execution (permanent).
 */
export async function sendMessage({
  outgoingMessageId,
  flowExecutionId,
}: SendMessageArgs): Promise<void> {
  const [msg] = await db.select().from(message).where(eq(message.id, outgoingMessageId)).limit(1);
  if (!msg) {
    logger.warn({ outgoing_message_id: outgoingMessageId }, 'message not found');
    return;
  }
  if (msg.status === 'sent') {
    return; // already sent (job replay)
  }

  // Manual sends (from the inbox UI) don't have a flow_execution. They pass
  // flowExecutionId='' to signal "no execution to advance". For those we
  // resolve the IG account + conversation directly off the message row.
  const isManualSend = flowExecutionId === '';

  let exec: typeof flowExecution.$inferSelect | null = null;
  if (!isManualSend) {
    const [row] = await db
      .select()
      .from(flowExecution)
      .where(eq(flowExecution.id, flowExecutionId))
      .limit(1);
    if (!row) {
      await failMessage(outgoingMessageId, 'flow_execution not found');
      return;
    }
    if (row.status === 'cancelled' || row.status === 'failed' || row.status === 'done') {
      await failMessage(outgoingMessageId, `execution status is ${row.status}`);
      return;
    }
    exec = row;
  }

  const [account] = await db
    .select()
    .from(instagramAccount)
    .where(eq(instagramAccount.id, msg.instagramAccountId))
    .limit(1);
  if (!account) {
    await failMessage(outgoingMessageId, 'instagram account not found');
    return;
  }

  const [conv] = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, msg.conversationId))
    .limit(1);
  if (!conv) {
    await failMessage(outgoingMessageId, 'conversation not found');
    return;
  }

  // Rate limit per account.
  const allowed = await rateLimiter.consume(account.id);
  if (!allowed) {
    // re-throw to let BullMQ retry with backoff
    throw new Error(`rate limited for account ${account.id}`);
  }

  // Pause-on-human: respect 30-min freeze when an operator just took over.
  if (conv.automationPausedUntil && conv.automationPausedUntil > new Date()) {
    await failMessage(outgoingMessageId, 'conversation is paused (human took over)');
    return;
  }

  const clients = createChannelClient(account);
  // Manual sends don't carry execution state — defaults are fine since
  // they're plain DM replies (no comment-to-DM bootstrap, no flow advance).
  const state = (exec?.state as Record<string, unknown>) ?? {};
  const triggerCommentId = state.triggerCommentId as string | null | undefined;

  // Lift any quick-reply chips off the persisted contentAttributes — they
  // were stashed there by execute-flow when the action.send_dm node ran.
  const attrs = (msg.contentAttributes as Record<string, unknown> | null) ?? {};
  const quickReplyTitles = Array.isArray(attrs.quickReplies)
    ? (attrs.quickReplies as unknown[]).map((s) => String(s)).filter(Boolean)
    : [];
  const quickReplies = quickReplyTitles.map((title) => ({ title, payload: title }));

  try {
    let metaMessageId = '';

    if (msg.messageType === 'activity') {
      // reply_comment node — public reply on the original comment.
      // Both Instagram and Threads support this via ChannelClient.replyComment.
      if (!triggerCommentId) {
        await failMessage(outgoingMessageId, 'reply_comment requires triggerCommentId in state');
        return;
      }
      const r = await clients.common.replyComment({
        commentId: triggerCommentId,
        message: msg.content ?? '',
      });
      metaMessageId = r.id;
    } else {
      // outgoing DM — only valid for Instagram. Threads has no DM API today.
      if (!clients.instagram) {
        await failMessage(
          outgoingMessageId,
          `dm_unsupported_for_channel: ${clients.channel} accounts cannot send DMs`,
        );
        if (!isManualSend) {
          await failExecutionLater(flowExecutionId, 'dm_unsupported_for_channel');
        }
        return;
      }
      const ig = clients.instagram;

      const inWindow =
        conv.lastIncomingAt && Date.now() - conv.lastIncomingAt.getTime() < TWENTY_FOUR_HOURS_MS;
      const useCommentRecipient = !!triggerCommentId && !state.firstDmSent;

      if (!inWindow && !useCommentRecipient) {
        await failMessage(outgoingMessageId, '24h messaging window expired and no comment context');
        if (!isManualSend) {
          await failExecutionLater(flowExecutionId, 'window_expired');
        }
        return;
      }

      if (useCommentRecipient && triggerCommentId) {
        const r = await ig.sendDmByCommentId({
          commentId: triggerCommentId,
          text: msg.content ?? '',
          ...(quickReplies.length > 0 ? { quickReplies } : {}),
        });
        metaMessageId = r.messageId;
        // Mark first-dm-sent so subsequent DMs go via IGSID.
        state.firstDmSent = true;
      } else {
        const [inbox] = await db
          .select()
          .from(contactInbox)
          .where(eq(contactInbox.id, conv.contactInboxId))
          .limit(1);
        if (!inbox) {
          await failMessage(outgoingMessageId, 'contact_inbox not found');
          return;
        }
        const r = await ig.sendDmByIgsid({
          igsid: inbox.sourceId,
          text: msg.content ?? '',
          ...(quickReplies.length > 0 ? { quickReplies } : {}),
        });
        metaMessageId = r.messageId;
      }
    }

    await db
      .update(message)
      .set({
        status: 'sent',
        sourceId: metaMessageId || msg.sourceId,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(message.id, outgoingMessageId));

    // Notify SSE subscribers — operator sees the bubble flip from "queued"
    // to delivered without waiting for the polling tick.
    await publishInboxEvent(account.organizationId, {
      kind: 'message_inserted',
      conversationId: msg.conversationId,
      messageId: outgoingMessageId,
    });

    if (exec) {
      await advanceExecution(exec.id, exec.flowId, exec.currentNodeId, state);
    }
  } catch (err) {
    if (err instanceof IgError) {
      if (err.kind === 'rate_limit' || err.kind === 'transient') {
        // BullMQ retry
        throw err;
      }
      await failMessage(outgoingMessageId, `${err.kind}: ${err.message}`);
      if (!isManualSend) {
        if (err.kind === 'token_invalid' || err.kind === 'permanent') {
          await failExecutionLater(flowExecutionId, err.kind);
        }
        if (err.kind === 'window_expired') {
          await failExecutionLater(flowExecutionId, 'window_expired');
        }
      }
      return;
    }
    throw err;
  }
}

async function advanceExecution(
  executionId: string,
  flowId: string,
  fromNodeId: string | null,
  state: Record<string, unknown>,
): Promise<void> {
  if (!fromNodeId) return;

  const [flowRow] = await db
    .select({ publishedGraph: flow.publishedGraph })
    .from(flow)
    .where(eq(flow.id, flowId))
    .limit(1);

  // Prefer the snapshot stored on the execution to avoid mid-flight republish surprises.
  const [exec] = await db
    .select({ graphSnapshot: flowExecution.graphSnapshot, visitedNodes: flowExecution.visitedNodes })
    .from(flowExecution)
    .where(eq(flowExecution.id, executionId))
    .limit(1);

  if (!exec) return;
  const parsed = flowGraphSchema.safeParse(exec.graphSnapshot ?? flowRow?.publishedGraph);
  if (!parsed.success) {
    logger.error({ execution_id: executionId }, 'cannot parse graph snapshot');
    return;
  }
  const graph: FlowGraph = parsed.data;

  // Confirm the source node still exists in the snapshot.
  if (!getNodeById(graph, fromNodeId)) {
    return;
  }

  const nextId = findNextNodeId(graph, fromNodeId);
  const visited = new Set(((exec.visitedNodes as string[] | null) ?? []).map(String));
  if (nextId) visited.add(nextId);

  await db
    .update(flowExecution)
    .set({
      currentNodeId: nextId,
      visitedNodes: [...visited],
      state,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(flowExecution.id, executionId));

  if (nextId) {
    const job: ExecuteFlowJob = { flowExecutionId: executionId };
    await executionQueue.add('execute', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
    });
  } else {
    await db
      .update(flowExecution)
      .set({ status: 'done', finishedAt: new Date() })
      .where(eq(flowExecution.id, executionId));
  }
}

async function failMessage(messageId: string, reason: string): Promise<void> {
  await db
    .update(message)
    .set({
      status: 'failed',
      errorMessage: reason,
      updatedAt: new Date(),
    })
    .where(eq(message.id, messageId));
}

async function failExecutionLater(executionId: string, reason: string): Promise<void> {
  await db
    .update(flowExecution)
    .set({
      status: 'failed',
      errorMessage: reason,
      finishedAt: new Date(),
      isReplying: false,
      updatedAt: new Date(),
    })
    .where(eq(flowExecution.id, executionId));
}
