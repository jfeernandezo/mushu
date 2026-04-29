import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { organization, user } from './auth.ts';
import { instagramAccount } from './domain.ts';

// Re-exported below — declared at module bottom to keep file order stable.

/**
 * Audit trail for everything Meta sends us. Also a dedupe layer:
 * if Meta retries a webhook, we already saw the eventId and skip processing.
 *
 * eventId is composed from the inbound payload: <object>:<entry.id>:<change.id>
 * or for messaging events: <recipient.id>:<message.mid>. Always unique-able.
 *
 * type narrows the discriminator so a single jsonb payload can hold any
 * webhook variant Meta sends.
 */
export const incomingEvent = pgTable(
  'incoming_event',
  {
    id: text('id').primaryKey(),
    instagramAccountId: text('instagram_account_id').references(() => instagramAccount.id, {
      onDelete: 'set null',
    }),
    eventId: text('event_id').notNull(),
    type: text('type', {
      enum: [
        'comment',
        'message',
        'message_echo',
        'message_reaction',
        'message_seen',
        'story_reply',
        'story_mention',
        'mention',
        // Threads channel events
        'threads_reply',
        'threads_mention',
        'unknown',
      ],
    }).notNull(),
    payload: jsonb('payload').notNull(),
    headers: jsonb('headers').notNull().default(sql`'{}'::jsonb`),
    processedAt: timestamp('processed_at'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    eventIdUnique: uniqueIndex('incoming_event_event_id_unique').on(t.eventId),
    accountTypeIdx: index('incoming_event_account_type_idx').on(t.instagramAccountId, t.type),
    // Used by the retention sweeper (apps/worker/src/processors/sweep-events.ts)
    // to delete rows older than 90 days without a full table scan.
    createdAtIdx: index('incoming_event_created_at_idx').on(t.createdAt),
  }),
);

/**
 * Outbound email delivery log. Backs the bounce-handling and pre-send
 * deliverability gate in `apps/web/src/lib/email.ts`. We don't store the body
 * (subject is enough for ops); status transitions are append-only — a bounced
 * recipient gets a NEW row, never an UPDATE, so the count-of-bounces query is
 * trivial.
 *
 * Status:
 *   - sent     : transporter accepted; downstream NDR may still arrive
 *   - bounced  : SMTP 5xx OR ingested NDR
 *   - deferred : SMTP 4xx; transient
 */
export const emailDelivery = pgTable(
  'email_delivery',
  {
    id: text('id').primaryKey(),
    recipientEmail: text('recipient_email').notNull(),
    messageType: text('message_type').notNull(),
    status: text('status', { enum: ['sent', 'bounced', 'deferred'] }).notNull(),
    subject: text('subject'),
    smtpResponse: text('smtp_response'),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    recipientStatusIdx: index('email_delivery_recipient_status_idx').on(
      sql`lower(${t.recipientEmail})`,
      t.status,
    ),
    sentAtIdx: index('email_delivery_sent_at_idx').on(t.sentAt),
  }),
);

/**
 * High-level audit log for actions inside the app — connect IG, publish flow,
 * delete contact, change plan, etc.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').references(() => organization.id, {
      onDelete: 'cascade',
    }),
    actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('audit_log_org_idx').on(t.organizationId),
    actionIdx: index('audit_log_action_idx').on(t.action),
  }),
);
