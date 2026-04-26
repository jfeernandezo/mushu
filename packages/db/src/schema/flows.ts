import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organization } from './auth.ts';
import { contact, conversation, instagramAccount } from './domain.ts';

/**
 * A flow (= ManyChat "automation"). Graph stored as JSON blob (Typebot pattern).
 *
 * Split draft/published: draftGraph is what the builder UI mutates;
 * publishedGraph is what the runtime serves. publishVersion increments on
 * every Publish — webhook handler always reads publishedGraph for new
 * executions, but executions already in flight keep using whatever graph
 * snapshot they started with (stored in flow_execution.state).
 */
export const flow = pgTable(
  'flow',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    instagramAccountId: text('instagram_account_id').references(() => instagramAccount.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    description: text('description'),
    draftGraph: jsonb('draft_graph').notNull().default(sql`'{"nodes":[],"edges":[]}'::jsonb`),
    publishedGraph: jsonb('published_graph'),
    publishVersion: integer('publish_version').notNull().default(0),
    isEnabled: boolean('is_enabled').notNull().default(false),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('flow_org_idx').on(t.organizationId),
    accountIdx: index('flow_account_idx').on(t.instagramAccountId),
  }),
);

/**
 * What starts a flow. Multiple triggers can point to the same flow.
 *
 * type:
 *   - comment_keyword: comment on an IG post matching keyword(s)
 *   - dm_keyword:      DM to the IG account matching keyword(s)
 *   - story_reply:     reply to a story
 *   - story_mention:   mentioned in someone's story
 *   - ref_url:         user clicked an ig.me ref URL
 *   - manual:          dispatched programmatically (broadcasts, tests)
 *
 * instagramPostId is INDEXED — comment-keyword triggers are looked up by
 * (instagramAccountId, instagramPostId) on every webhook (lesson from
 * ZernFlow's missing index).
 */
export const trigger = pgTable(
  'trigger',
  {
    id: text('id').primaryKey(),
    flowId: text('flow_id')
      .notNull()
      .references(() => flow.id, { onDelete: 'cascade' }),
    instagramAccountId: text('instagram_account_id')
      .notNull()
      .references(() => instagramAccount.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: [
        'comment_keyword',
        'dm_keyword',
        'story_reply',
        'story_mention',
        'ref_url',
        'manual',
      ],
    }).notNull(),
    instagramPostId: text('instagram_post_id'),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    priority: integer('priority').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    flowIdx: index('trigger_flow_idx').on(t.flowId),
    accountTypeIdx: index('trigger_account_type_idx').on(t.instagramAccountId, t.type),
    accountPostIdx: index('trigger_account_post_idx').on(
      t.instagramAccountId,
      t.instagramPostId,
    ),
    orgIdx: index('trigger_org_idx').on(t.organizationId),
  }),
);

/**
 * One run of a flow for one contact. Persists state across async steps
 * (DM sequences with Smart Delay can span days).
 *
 * Lessons applied:
 *   - isReplying flag (Typebot) — anti-concurrency: prevents two webhook
 *     events from advancing the same execution simultaneously.
 *   - visitedNodes (mitigates ZernFlow's loop risk): prevents infinite cycles.
 *   - graphSnapshot: copy of flow.publishedGraph at start time, so re-publishes
 *     don't break in-flight executions.
 *
 * status:
 *   - active: ready to advance now
 *   - waiting: blocked on a Delay node — will wake at wakeAt
 *   - awaiting_input: blocked waiting for contact reply (e.g. data collection)
 *   - done: completed successfully
 *   - failed: errored out — see errorMessage
 *   - cancelled: stopped (e.g. flow disabled, contact unsubscribed)
 */
export const flowExecution = pgTable(
  'flow_execution',
  {
    id: text('id').primaryKey(),
    flowId: text('flow_id')
      .notNull()
      .references(() => flow.id, { onDelete: 'cascade' }),
    flowPublishVersion: integer('flow_publish_version').notNull(),
    triggerId: text('trigger_id').references(() => trigger.id, { onDelete: 'set null' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    instagramAccountId: text('instagram_account_id')
      .notNull()
      .references(() => instagramAccount.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contact.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => conversation.id, {
      onDelete: 'set null',
    }),
    currentNodeId: text('current_node_id'),
    visitedNodes: jsonb('visited_nodes').notNull().default(sql`'[]'::jsonb`),
    state: jsonb('state').notNull().default(sql`'{}'::jsonb`),
    graphSnapshot: jsonb('graph_snapshot').notNull(),
    isReplying: boolean('is_replying').notNull().default(false),
    status: text('status', {
      enum: ['active', 'waiting', 'awaiting_input', 'done', 'failed', 'cancelled'],
    })
      .notNull()
      .default('active'),
    wakeAt: timestamp('wake_at'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    flowIdx: index('flow_execution_flow_idx').on(t.flowId),
    contactIdx: index('flow_execution_contact_idx').on(t.contactId),
    statusWakeIdx: index('flow_execution_status_wake_idx').on(t.status, t.wakeAt),
    contactFlowUnique: uniqueIndex('flow_execution_active_unique')
      .on(t.flowId, t.contactId)
      .where(sql`status IN ('active','waiting','awaiting_input')`),
  }),
);
