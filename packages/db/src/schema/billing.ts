import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { organization } from './auth.ts';
import { permissionGroup } from './permissions.ts';

/**
 * Plans are the orgsubscription tiers. Limits live as columns (numeric values
 * fit poorly into the permission system); features that gate UI/blocks live
 * as permissions linked via plan_permission_group.
 *
 * `is_listed=false` lets us keep an old price grandfathered for legacy orgs
 * without showing it on /pricing for new signups.
 */
export const plan = pgTable('plan', {
  code: text('code').primaryKey(),                 // 'free' | 'pro' | 'agency'
  name: text('name').notNull(),
  displayOrder: integer('display_order').notNull(),
  priceBrlCents: integer('price_brl_cents').notNull().default(0),
  stripePriceId: text('stripe_price_id'),          // null for free
  maxContacts: integer('max_contacts').notNull(),
  maxIgAccounts: integer('max_ig_accounts').notNull(),
  maxOperators: integer('max_operators').notNull(),
  isListed: boolean('is_listed').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const planPermissionGroup = pgTable(
  'plan_permission_group',
  {
    planCode: text('plan_code')
      .notNull()
      .references(() => plan.code, { onDelete: 'cascade' }),
    groupCode: text('group_code')
      .notNull()
      .references(() => permissionGroup.code, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.planCode, t.groupCode] }),
  }),
);

/**
 * One subscription per organization. Stripe-related columns are NULL when:
 *   - the plan is 'free' (no charge, no Stripe customer)
 *   - the deployment is in selfhost mode (Stripe never consulted)
 *
 * status values mirror Stripe's vocabulary so webhook handlers can write
 * them through verbatim. The resolver only treats 'active' and 'trialing'
 * as granting plan features.
 */
export const subscription = pgTable(
  'subscription',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: 'cascade' }),
    planCode: text('plan_code')
      .notNull()
      .references(() => plan.code),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    status: text('status', {
      enum: ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid'],
    })
      .notNull()
      .default('active'),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    trialEnd: timestamp('trial_end'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('subscription_org_idx').on(t.organizationId),
    statusIdx: index('subscription_status_idx').on(t.status),
  }),
);
