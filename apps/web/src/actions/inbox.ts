'use server';

import { randomUUID } from 'node:crypto';
import {
  contact,
  contactInbox,
  contactTag,
  conversation,
  db,
  instagramAccount,
  member,
  message,
  user as userTable,
  withOrgTx,
} from '@mushu/db';
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { hasPermission, requirePermission } from '@/lib/permissions';
import { enqueueSendMessage } from '@/lib/queue';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'snoozed';
export type SenderType = 'contact' | 'user' | 'automation' | 'system';
export type MessageType = 'incoming' | 'outgoing' | 'activity';

export interface InboxConversationRow {
  id: string;
  displayId: number;
  status: ConversationStatus;
  contactId: string;
  contactName: string | null;
  contactUsername: string | null;
  contactProfilePicUrl: string | null;
  igAccountId: string;
  igAccountUsername: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  lastActivityAt: Date;
  lastIncomingAt: Date | null;
  /** True iff `automationPausedUntil > now()`. Used to render a small "human took over" badge. */
  automationPaused: boolean;
  /** Snippet of the most recent message (any direction). Truncated to ~120 chars. */
  lastMessagePreview: string | null;
  lastMessageDirection: MessageType | null;
}

export interface InboxThreadMessage {
  id: string;
  conversationId: string;
  senderType: SenderType;
  /** user.id when senderType==='user'; contact.id when 'contact'; null otherwise. */
  senderId: string | null;
  senderName: string | null;
  messageType: MessageType;
  content: string | null;
  isPrivate: boolean;
  status: string | null;
  createdAt: Date;
  contentAttributes: Record<string, unknown>;
}

export interface InboxThreadDetails {
  conversation: {
    id: string;
    displayId: number;
    status: ConversationStatus;
    assigneeUserId: string | null;
    automationPausedUntil: Date | null;
    snoozedUntil: Date | null;
    lastActivityAt: Date;
    lastIncomingAt: Date | null;
  };
  contact: {
    id: string;
    name: string | null;
    username: string | null;
    profilePicUrl: string | null;
    customFields: Record<string, unknown>;
    tags: string[];
  };
  igAccount: {
    id: string;
    username: string;
  };
  messages: InboxThreadMessage[];
  /** True if the conversation can accept an outbound DM right now (24h window open AND not paused for our own pause-on-human flow). */
  canSendNow: boolean;
  /** Why the send is blocked, if any. */
  sendBlockedReason:
    | null
    | 'window_expired'
    | 'paused_for_automation'
    | 'no_permission';
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
/**
 * When an operator sends a message manually, automations are frozen for this
 * window. Matches the value the worker reads when deciding whether to deliver
 * an automation-generated message.
 */
const HUMAN_TAKEOVER_PAUSE_MS = 30 * 60 * 1000;
const PREVIEW_MAX_LEN = 120;

async function requireSession() {
  const s = await auth.api.getSession({ headers: await nextHeaders() });
  if (!s) throw new Error('unauthenticated');
  return s;
}

async function findMyMember(userId: string, orgId: string) {
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
    .limit(1);
  return m;
}

const listFiltersSchema = z.object({
  status: z
    .enum(['open', 'pending', 'resolved', 'snoozed', 'all'])
    .default('all')
    .optional(),
  igAccountId: z.string().nullable().optional(),
  /** 'me' resolves to the current user; null = unassigned; undefined = any. */
  assignee: z.union([z.literal('me'), z.literal('unassigned'), z.string()]).nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50).optional(),
});

/**
 * List conversations for the active org. Filters are best-effort — we always
 * scope to the org (RLS does it again as belt-and-suspenders) and return at
 * most `limit` rows ordered by `lastActivityAt DESC`.
 *
 * The "most recent message preview" is computed via a lateral subquery so we
 * stay in one round-trip — important since this drives the polling endpoint.
 */
export async function listInboxConversations(
  filters?: z.input<typeof listFiltersSchema>,
): Promise<ActionResult<InboxConversationRow[]>> {
  const parsed = listFiltersSchema.safeParse(filters ?? {});
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: true, data: [] };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    const can = await hasPermission(me.id, 'inbox.view');
    if (!can) return { ok: false, error: 'permission_denied' };

    const conditions = [eq(conversation.organizationId, orgId)];
    if (parsed.data.status && parsed.data.status !== 'all') {
      conditions.push(eq(conversation.status, parsed.data.status));
    }
    if (parsed.data.igAccountId) {
      conditions.push(eq(conversation.instagramAccountId, parsed.data.igAccountId));
    }
    if (parsed.data.assignee === 'me') {
      conditions.push(eq(conversation.assigneeUserId, session.user.id));
    } else if (parsed.data.assignee === 'unassigned') {
      conditions.push(sql`${conversation.assigneeUserId} IS NULL`);
    } else if (typeof parsed.data.assignee === 'string') {
      conditions.push(eq(conversation.assigneeUserId, parsed.data.assignee));
    }

    const limit = parsed.data.limit ?? 50;

    const rows = await withOrgTx(orgId, (tx) =>
      tx
        .select({
          id: conversation.id,
          displayId: conversation.displayId,
          status: conversation.status,
          contactId: conversation.contactId,
          contactName: contact.name,
          contactProfilePicUrl: contact.profilePicUrl,
          contactUsername: contactInbox.igUsername,
          igAccountId: conversation.instagramAccountId,
          igAccountUsername: instagramAccount.igUsername,
          assigneeUserId: conversation.assigneeUserId,
          assigneeName: userTable.name,
          lastActivityAt: conversation.lastActivityAt,
          lastIncomingAt: conversation.lastIncomingAt,
          automationPausedUntil: conversation.automationPausedUntil,
        })
        .from(conversation)
        .innerJoin(contact, eq(contact.id, conversation.contactId))
        .innerJoin(contactInbox, eq(contactInbox.id, conversation.contactInboxId))
        .innerJoin(instagramAccount, eq(instagramAccount.id, conversation.instagramAccountId))
        .leftJoin(userTable, eq(userTable.id, conversation.assigneeUserId))
        .where(and(...conditions))
        .orderBy(desc(conversation.lastActivityAt))
        .limit(limit),
    );

    if (rows.length === 0) return { ok: true, data: [] };

    // Pull the most-recent message per conversation in a single query.
    const conversationIds = rows.map((r) => r.id);
    const previews = await withOrgTx(orgId, (tx) =>
      tx.execute<{
        conversation_id: string;
        content: string | null;
        message_type: MessageType;
      }>(sql`
        SELECT DISTINCT ON (conversation_id)
          conversation_id, content, message_type
        FROM "message"
        WHERE conversation_id IN ${conversationIds}
          AND is_private = false
        ORDER BY conversation_id, created_at DESC
      `),
    );
    const previewByConv = new Map<string, { content: string | null; messageType: MessageType }>();
    for (const p of previews) {
      previewByConv.set(p.conversation_id, {
        content: p.content,
        messageType: p.message_type,
      });
    }

    const now = Date.now();
    return {
      ok: true,
      data: rows.map<InboxConversationRow>((r) => {
        const preview = previewByConv.get(r.id);
        const previewText = preview?.content
          ? preview.content.length > PREVIEW_MAX_LEN
            ? `${preview.content.slice(0, PREVIEW_MAX_LEN - 1)}…`
            : preview.content
          : null;
        return {
          id: r.id,
          displayId: r.displayId,
          status: r.status as ConversationStatus,
          contactId: r.contactId,
          contactName: r.contactName,
          contactUsername: r.contactUsername,
          contactProfilePicUrl: r.contactProfilePicUrl,
          igAccountId: r.igAccountId,
          igAccountUsername: r.igAccountUsername,
          assigneeUserId: r.assigneeUserId,
          assigneeName: r.assigneeName,
          lastActivityAt: r.lastActivityAt,
          lastIncomingAt: r.lastIncomingAt,
          automationPaused: !!(r.automationPausedUntil && r.automationPausedUntil.getTime() > now),
          lastMessagePreview: previewText,
          lastMessageDirection: preview?.messageType ?? null,
        };
      }),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

const threadParamsSchema = z.object({
  conversationId: z.string().min(1),
  /** Hard cap on history depth — pagination/scrollback will come later. */
  messageLimit: z.number().int().min(1).max(500).default(200).optional(),
});

/**
 * Load a single conversation with full thread, contact details, and gating
 * info for the manual-send button. Returns null for unknown/foreign convos
 * (RLS should already prevent cross-org access, but we double-check the org
 * id and return a clean "not found" rather than leaking RLS behavior).
 */
export async function getInboxThread(
  params: z.input<typeof threadParamsSchema>,
): Promise<ActionResult<InboxThreadDetails | null>> {
  const parsed = threadParamsSchema.safeParse(params);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: true, data: null };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    const [canView, canReply] = await Promise.all([
      hasPermission(me.id, 'inbox.view'),
      hasPermission(me.id, 'inbox.reply'),
    ]);
    if (!canView) return { ok: false, error: 'permission_denied' };

    const result = await withOrgTx(orgId, async (tx) => {
      const [convRow] = await tx
        .select({
          conv: conversation,
          contact,
          contactInbox,
          igAccount: instagramAccount,
        })
        .from(conversation)
        .innerJoin(contact, eq(contact.id, conversation.contactId))
        .innerJoin(contactInbox, eq(contactInbox.id, conversation.contactInboxId))
        .innerJoin(instagramAccount, eq(instagramAccount.id, conversation.instagramAccountId))
        .where(eq(conversation.id, parsed.data.conversationId))
        .limit(1);

      if (!convRow) return null;

      const limit = parsed.data.messageLimit ?? 200;

      const messages = await tx
        .select({
          id: message.id,
          conversationId: message.conversationId,
          senderType: message.senderType,
          senderId: message.senderId,
          messageType: message.messageType,
          content: message.content,
          isPrivate: message.isPrivate,
          status: message.status,
          createdAt: message.createdAt,
          contentAttributes: message.contentAttributes,
        })
        .from(message)
        .where(eq(message.conversationId, parsed.data.conversationId))
        .orderBy(asc(message.createdAt))
        .limit(limit);

      // Hydrate sender names for `senderType === 'user'` messages in one shot.
      const userSenderIds = Array.from(
        new Set(
          messages
            .filter((m) => m.senderType === 'user' && m.senderId)
            .map((m) => m.senderId as string),
        ),
      );
      const userNames = new Map<string, string>();
      if (userSenderIds.length > 0) {
        const users = await tx
          .select({ id: userTable.id, name: userTable.name })
          .from(userTable)
          .where(inArray(userTable.id, userSenderIds));
        for (const u of users) userNames.set(u.id, u.name);
      }

      const tagRows = await tx
        .select({ tag: contactTag.tag })
        .from(contactTag)
        .where(eq(contactTag.contactId, convRow.contact.id));

      return {
        convRow,
        messages,
        userNames,
        tags: tagRows.map((r) => r.tag),
      };
    });

    if (!result) return { ok: true, data: null };
    const { convRow, messages, userNames, tags } = result;

    const now = Date.now();
    const inWindow =
      convRow.conv.lastIncomingAt &&
      now - convRow.conv.lastIncomingAt.getTime() < TWENTY_FOUR_HOURS_MS;
    const pausedForAutomation =
      convRow.conv.automationPausedUntil &&
      convRow.conv.automationPausedUntil.getTime() > now;

    let canSendNow = canReply;
    let sendBlockedReason: InboxThreadDetails['sendBlockedReason'] = null;
    if (!canReply) {
      canSendNow = false;
      sendBlockedReason = 'no_permission';
    } else if (!inWindow) {
      canSendNow = false;
      sendBlockedReason = 'window_expired';
    } else if (pausedForAutomation) {
      // The pause flag exists to stop AUTOMATIONS from sending — humans should
      // be able to send anyway. So this state actually does NOT block manual
      // sends. We still surface the flag in the UI but keep canSendNow=true.
      sendBlockedReason = null;
    }

    return {
      ok: true,
      data: {
        conversation: {
          id: convRow.conv.id,
          displayId: convRow.conv.displayId,
          status: convRow.conv.status as ConversationStatus,
          assigneeUserId: convRow.conv.assigneeUserId,
          automationPausedUntil: convRow.conv.automationPausedUntil,
          snoozedUntil: convRow.conv.snoozedUntil,
          lastActivityAt: convRow.conv.lastActivityAt,
          lastIncomingAt: convRow.conv.lastIncomingAt,
        },
        contact: {
          id: convRow.contact.id,
          name: convRow.contact.name,
          username: convRow.contactInbox.igUsername,
          profilePicUrl: convRow.contact.profilePicUrl,
          customFields:
            (convRow.contact.customFields as Record<string, unknown> | null) ?? {},
          tags,
        },
        igAccount: {
          id: convRow.igAccount.id,
          username: convRow.igAccount.igUsername,
        },
        messages: messages.map<InboxThreadMessage>((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          senderType: m.senderType as SenderType,
          senderId: m.senderId,
          senderName:
            m.senderType === 'user' && m.senderId ? userNames.get(m.senderId) ?? null : null,
          messageType: m.messageType as MessageType,
          content: m.content,
          isPrivate: m.isPrivate,
          status: m.status,
          createdAt: m.createdAt,
          contentAttributes: (m.contentAttributes as Record<string, unknown> | null) ?? {},
        })),
        canSendNow,
        sendBlockedReason,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string().min(1).max(2000),
  /** When true, persists the message but never sends it via Graph API and is
   *  hidden from the contact. Used for internal team notes. */
  isPrivate: z.boolean().default(false).optional(),
});

/**
 * Send a manual reply (or post a private internal note) on a conversation.
 *
 * Behaviour:
 *   - Persists `message` row immediately so the operator sees it in the thread.
 *   - For non-private messages: enqueues the worker `sendMessage` job which
 *     calls Graph API; also sets `automationPausedUntil = now() + 30min` so
 *     no automation steps in.
 *   - For private notes: skip the queue entirely.
 *
 * Window enforcement: we do NOT re-check the 24h window here — `getInboxThread`
 * surfaces it for the UI to disable the send button. If the operator bypasses
 * the UI, the worker rejects the send with a `window_expired` error and the
 * message ends up status=failed; that's acceptable.
 */
export async function sendManualMessage(
  input: z.input<typeof sendMessageSchema>,
): Promise<ActionResult<{ messageId: string }>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false, error: 'no_active_org' };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    await requirePermission(me.id, 'inbox.reply');

    const messageId = await withOrgTx(orgId, async (tx) => {
      const [conv] = await tx
        .select({
          id: conversation.id,
          instagramAccountId: conversation.instagramAccountId,
        })
        .from(conversation)
        .where(eq(conversation.id, parsed.data.conversationId))
        .limit(1);
      if (!conv) throw new Error('conversation_not_found');

      const id = randomUUID();
      const isPrivate = parsed.data.isPrivate ?? false;
      await tx.insert(message).values({
        id,
        conversationId: conv.id,
        instagramAccountId: conv.instagramAccountId,
        organizationId: orgId,
        senderType: 'user',
        senderId: session.user.id,
        messageType: isPrivate ? 'activity' : 'outgoing',
        contentType: isPrivate ? 'system' : 'text',
        status: isPrivate ? null : 'queued',
        content: parsed.data.text,
        isPrivate,
      });

      // Bump conversation activity so it floats to the top of the inbox list.
      await tx
        .update(conversation)
        .set({
          lastActivityAt: new Date(),
          ...(isPrivate
            ? {}
            : {
                automationPausedUntil: new Date(Date.now() + HUMAN_TAKEOVER_PAUSE_MS),
                // Anyone who sends manually is now responsible for the convo —
                // mark as 'open' to take it out of the bot/automation bucket.
                status: 'open' as const,
                ...(conversation.assigneeUserId ? {} : { assigneeUserId: session.user.id }),
              }),
          updatedAt: new Date(),
        })
        .where(eq(conversation.id, conv.id));

      return id;
    });

    if (!parsed.data.isPrivate) {
      // sendMessage worker expects a flowExecutionId — for manual sends we
      // pass an empty string sentinel; the processor branches on this to
      // skip flow-advance logic.
      try {
        await enqueueSendMessage({ outgoingMessageId: messageId, flowExecutionId: '' });
      } catch (err) {
        console.error('[inbox] failed to enqueue send', err);
        // Don't fail the action — operator already sees the message in the
        // thread, and a sweeper job will retry queued messages.
      }
    }

    revalidatePath('/inbox');
    return { ok: true, data: { messageId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

const updateConversationSchema = z.object({
  conversationId: z.string().min(1),
  status: z.enum(['open', 'pending', 'resolved', 'snoozed']).optional(),
  assigneeUserId: z.string().nullable().optional(),
  /** Snooze hours — 1, 24, or 72 (1h / 1d / 3d). */
  snoozeHours: z.union([z.literal(1), z.literal(24), z.literal(72)]).optional(),
});

/**
 * Update conversation status / assignee / snooze. All three patches go
 * through the same action so we only have one server endpoint to wire.
 *
 * Snoozing automatically sets status='snoozed' and a `snoozedUntil` that the
 * UI uses to hide it from the default "open"/"pending" filter.
 */
export async function updateConversation(
  input: z.input<typeof updateConversationSchema>,
): Promise<ActionResult> {
  const parsed = updateConversationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false, error: 'no_active_org' };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    await requirePermission(me.id, 'inbox.reply');

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.status) patch.status = parsed.data.status;
    if (parsed.data.assigneeUserId !== undefined) {
      patch.assigneeUserId = parsed.data.assigneeUserId;
    }
    if (parsed.data.snoozeHours) {
      patch.status = 'snoozed';
      patch.snoozedUntil = new Date(Date.now() + parsed.data.snoozeHours * 60 * 60 * 1000);
    }

    await withOrgTx(orgId, (tx) =>
      tx
        .update(conversation)
        .set(patch)
        .where(eq(conversation.id, parsed.data.conversationId)),
    );

    revalidatePath('/inbox');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

const tagSchema = z.object({
  conversationId: z.string().min(1),
  /** Lowercased + slugified server-side, kept short. */
  tag: z
    .string()
    .min(1)
    .max(60)
    .transform((s) => s.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60).toLowerCase()),
  operation: z.enum(['add', 'remove']),
});

/**
 * Add or remove a tag on the conversation's contact. Same code path the
 * `set_tag` flow node uses — convergent behavior so manual tags and
 * automation tags live in the same table.
 */
export async function setConversationTag(
  input: z.input<typeof tagSchema>,
): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  if (!parsed.data.tag) return { ok: false, error: 'empty_tag' };
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false, error: 'no_active_org' };

    const me = await findMyMember(session.user.id, orgId);
    if (!me) return { ok: false, error: 'not_a_member' };
    await requirePermission(me.id, 'contact.edit');

    await withOrgTx(orgId, async (tx) => {
      const [conv] = await tx
        .select({ contactId: conversation.contactId })
        .from(conversation)
        .where(eq(conversation.id, parsed.data.conversationId))
        .limit(1);
      if (!conv) throw new Error('conversation_not_found');
      if (parsed.data.operation === 'add') {
        await tx
          .insert(contactTag)
          .values({
            contactId: conv.contactId,
            organizationId: orgId,
            tag: parsed.data.tag,
          })
          .onConflictDoNothing();
      } else {
        await tx
          .delete(contactTag)
          .where(
            and(eq(contactTag.contactId, conv.contactId), eq(contactTag.tag, parsed.data.tag)),
          );
      }
    });

    revalidatePath('/inbox');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

/**
 * Inbox capabilities for the current user — used by the page to gate the
 * compose box and the conversation-action buttons without making one
 * permission round-trip per render.
 */
export async function getInboxCapabilities(): Promise<{
  canView: boolean;
  canReply: boolean;
  canEditContact: boolean;
  myUserId: string | null;
  myName: string | null;
}> {
  try {
    const session = await requireSession();
    const orgId = session.session.activeOrganizationId;
    if (!orgId) {
      return {
        canView: false,
        canReply: false,
        canEditContact: false,
        myUserId: null,
        myName: null,
      };
    }
    const me = await findMyMember(session.user.id, orgId);
    if (!me) {
      return {
        canView: false,
        canReply: false,
        canEditContact: false,
        myUserId: null,
        myName: null,
      };
    }
    const [canView, canReply, canEditContact] = await Promise.all([
      hasPermission(me.id, 'inbox.view'),
      hasPermission(me.id, 'inbox.reply'),
      hasPermission(me.id, 'contact.edit'),
    ]);
    return {
      canView,
      canReply,
      canEditContact,
      myUserId: session.user.id,
      myName: session.user.name,
    };
  } catch {
    return {
      canView: false,
      canReply: false,
      canEditContact: false,
      myUserId: null,
      myName: null,
    };
  }
}

// Reference unused imports so tree-shaking can decide.
void asc;
void gt;
