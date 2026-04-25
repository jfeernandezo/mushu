import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organization, user } from './auth.ts';

/**
 * Instagram account connected to an organization.
 * Equivalent to Chatwoot's Channel::Instagram, simplified for IG-only.
 * Token is encrypted at rest using TOKEN_ENCRYPTION_KEY (AES-256-GCM).
 */
export const instagramAccount = pgTable(
  'instagram_account',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    igUserId: text('ig_user_id').notNull(),
    igUsername: text('ig_username').notNull(),
    pageId: text('page_id'),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    accessTokenIv: text('access_token_iv').notNull(),
    accessTokenAuthTag: text('access_token_auth_tag').notNull(),
    expiresAt: timestamp('expires_at'),
    webhookSubscribed: boolean('webhook_subscribed').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    igUserIdUnique: uniqueIndex('instagram_account_ig_user_id_unique').on(t.igUserId),
    orgIdx: index('instagram_account_org_idx').on(t.organizationId),
  }),
);

/**
 * A unified person across an organization. Identified by IG identifier today,
 * but designed so we can merge identities across channels later.
 */
export const contact = pgTable(
  'contact',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name'),
    email: text('email'),
    phoneNumber: text('phone_number'),
    profilePicUrl: text('profile_pic_url'),
    customFields: jsonb('custom_fields').notNull().default(sql`'{}'::jsonb`),
    additionalAttributes: jsonb('additional_attributes').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('contact_org_idx').on(t.organizationId),
  }),
);

/**
 * Tags applied to a contact. Boolean — present or absent.
 * ManyChat-style: tags for events/states, custom_fields for data.
 */
export const contactTag = pgTable(
  'contact_tag',
  {
    contactId: text('contact_id')
      .notNull()
      .references(() => contact.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: uniqueIndex('contact_tag_pk').on(t.contactId, t.tag),
  }),
);

/**
 * Junction between Contact and an Instagram account.
 * source_id is the IGSID (Instagram-Scoped ID) — what Meta sends in webhooks.
 * Chatwoot pattern: same Contact can have multiple ContactInboxes (different
 * source_ids per channel). For Mushu IG-only this is mostly 1:1, but we keep
 * the structure for future merging.
 */
export const contactInbox = pgTable(
  'contact_inbox',
  {
    id: text('id').primaryKey(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contact.id, { onDelete: 'cascade' }),
    instagramAccountId: text('instagram_account_id')
      .notNull()
      .references(() => instagramAccount.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').notNull(), // IGSID
    igUsername: text('ig_username'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    sourceUnique: uniqueIndex('contact_inbox_source_unique').on(
      t.instagramAccountId,
      t.sourceId,
    ),
    contactIdx: index('contact_inbox_contact_idx').on(t.contactId),
  }),
);

/**
 * A conversation thread on an IG account.
 * Status enum (Chatwoot): open / resolved / pending / snoozed.
 *  - pending: bot/automation owns it
 *  - open: a human agent is responsible
 *  - resolved: closed
 *  - snoozed: paused until snoozedUntil
 *
 * automationPausedUntil: when a human agent sends a message, automations skip
 * sending DMs until this timestamp. Replicates ManyChat's "pause 30 min on
 * human takeover" behavior.
 */
export const conversation = pgTable(
  'conversation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    instagramAccountId: text('instagram_account_id')
      .notNull()
      .references(() => instagramAccount.id, { onDelete: 'cascade' }),
    contactInboxId: text('contact_inbox_id')
      .notNull()
      .references(() => contactInbox.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contact.id, { onDelete: 'cascade' }),
    displayId: serial('display_id').notNull(),
    status: text('status', { enum: ['open', 'resolved', 'pending', 'snoozed'] })
      .notNull()
      .default('pending'),
    priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }),
    assigneeUserId: text('assignee_user_id').references(() => user.id, { onDelete: 'set null' }),
    automationPausedUntil: timestamp('automation_paused_until'),
    snoozedUntil: timestamp('snoozed_until'),
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
    lastIncomingAt: timestamp('last_incoming_at'),
    customAttributes: jsonb('custom_attributes').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    accountStatusIdx: index('conversation_account_status_idx').on(
      t.instagramAccountId,
      t.status,
    ),
    contactIdx: index('conversation_contact_idx').on(t.contactId),
    pausedIdx: index('conversation_paused_idx').on(t.automationPausedUntil),
  }),
);

/**
 * Messages in a conversation.
 * source_id stores the IG mid (message id from Meta) — UNIQUE per
 * instagramAccount, gives us idempotency on webhook retries (Chatwoot pattern).
 *
 * messageType:
 *   - incoming: from contact (received via webhook)
 *   - outgoing: from us (sent via Graph API)
 *   - activity: system event in timeline ("flow X started", "human took over")
 *
 * createdByAutomationId points to a flow_execution that produced this message.
 * Used to skip auto-trigger loops (don't react to our own outbound DM).
 */
export const message = pgTable(
  'message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    instagramAccountId: text('instagram_account_id')
      .notNull()
      .references(() => instagramAccount.id, { onDelete: 'cascade' }),
    senderType: text('sender_type', { enum: ['contact', 'user', 'automation', 'system'] })
      .notNull(),
    senderId: text('sender_id'), // user.id or contact.id or null for automation/system
    messageType: text('message_type', { enum: ['incoming', 'outgoing', 'activity'] }).notNull(),
    contentType: text('content_type', {
      enum: ['text', 'image', 'video', 'audio', 'file', 'template', 'system'],
    })
      .notNull()
      .default('text'),
    status: text('status', { enum: ['queued', 'sent', 'delivered', 'read', 'failed'] }),
    content: text('content'),
    contentAttributes: jsonb('content_attributes').notNull().default(sql`'{}'::jsonb`),
    sourceId: text('source_id'), // IG mid for incoming, mid returned by Graph API for outgoing
    isPrivate: boolean('is_private').notNull().default(false),
    createdByAutomationId: text('created_by_automation_id'), // FK to flow_execution.id (defined in flows.ts to avoid cycle)
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    conversationIdx: index('message_conversation_idx').on(t.conversationId),
    sourceUnique: uniqueIndex('message_source_unique').on(t.instagramAccountId, t.sourceId),
  }),
);
