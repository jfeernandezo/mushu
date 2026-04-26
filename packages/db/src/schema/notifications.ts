import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';
import { organization } from './auth.ts';

export const notification = pgTable(
  'notification',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('notification_org_created_idx').on(t.organizationId, t.createdAt),
    index('notification_org_unread_idx').on(t.organizationId, t.readAt),
  ],
);
