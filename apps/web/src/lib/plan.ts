import {
  contact,
  dbAdmin,
  instagramAccount,
  member,
  plan as planTable,
  subscription as subscriptionTable,
} from '@mushu/db';
import { createLogger } from '@mushu/shared/logger';
import { and, eq, sql } from 'drizzle-orm';

const logger = createLogger('web.plan');

export type PlanCode = 'free' | 'pro' | 'agency';
export type LimitName = 'contacts' | 'ig_accounts' | 'operators';
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid';

export interface PlanRow {
  code: string;
  name: string;
  priceBrlCents: number;
  maxContacts: number;
  maxIgAccounts: number;
  maxOperators: number;
  stripePriceId: string | null;
}

export interface SubscriptionRow {
  id: string;
  planCode: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface OrgPlan {
  plan: PlanRow;
  subscription: SubscriptionRow;
}

/**
 * Resolves the org's current plan + subscription. If somehow the org has no
 * subscription row (legacy data, race), inserts a Free one inline. Uses
 * dbAdmin so the lookup works outside a tenant transaction context.
 */
export async function getOrgPlan(orgId: string): Promise<OrgPlan> {
  const [sub] = await dbAdmin
    .select({
      id: subscriptionTable.id,
      planCode: subscriptionTable.planCode,
      status: subscriptionTable.status,
      currentPeriodEnd: subscriptionTable.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionTable.cancelAtPeriodEnd,
      stripeCustomerId: subscriptionTable.stripeCustomerId,
      stripeSubscriptionId: subscriptionTable.stripeSubscriptionId,
    })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.organizationId, orgId))
    .limit(1);

  const subscription: SubscriptionRow = sub ?? (await ensureSubscription(orgId));

  const [planRow] = await dbAdmin
    .select({
      code: planTable.code,
      name: planTable.name,
      priceBrlCents: planTable.priceBrlCents,
      maxContacts: planTable.maxContacts,
      maxIgAccounts: planTable.maxIgAccounts,
      maxOperators: planTable.maxOperators,
      stripePriceId: planTable.stripePriceId,
    })
    .from(planTable)
    .where(eq(planTable.code, subscription.planCode))
    .limit(1);

  if (!planRow) {
    // Subscription points at a plan that no longer exists. Treat it as Free
    // so the app keeps working — log so ops notice and reconcile manually.
    logger.error(
      { org_id: orgId, plan_code: subscription.planCode },
      'subscription points to unknown plan',
    );
    return {
      plan: {
        code: 'free',
        name: 'Free',
        priceBrlCents: 0,
        maxContacts: 1000,
        maxIgAccounts: 1,
        maxOperators: 1,
        stripePriceId: null,
      },
      subscription,
    };
  }

  return { plan: planRow, subscription };
}

/**
 * Ensures the org has a subscription row. Idempotent: safe to call from a
 * Better Auth hook on session create. Creates a Free subscription if none
 * exists; never downgrades an existing subscription.
 */
export async function ensureSubscription(orgId: string): Promise<SubscriptionRow> {
  const [existing] = await dbAdmin
    .select({
      id: subscriptionTable.id,
      planCode: subscriptionTable.planCode,
      status: subscriptionTable.status,
      currentPeriodEnd: subscriptionTable.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptionTable.cancelAtPeriodEnd,
      stripeCustomerId: subscriptionTable.stripeCustomerId,
      stripeSubscriptionId: subscriptionTable.stripeSubscriptionId,
    })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.organizationId, orgId))
    .limit(1);
  if (existing) return existing;

  const id = crypto.randomUUID();
  await dbAdmin.insert(subscriptionTable).values({
    id,
    organizationId: orgId,
    planCode: 'free',
    status: 'active',
  });
  return {
    id,
    planCode: 'free',
    status: 'active',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };
}

/**
 * Reports current usage against the org's plan limit for a given resource.
 *
 *   const r = await checkLimit(orgId, 'ig_accounts');
 *   if (!r.ok) return { error: 'upgrade_required' };
 *
 * Use BEFORE the inserting action. Race conditions between the check and the
 * insert can let an org go 1 over the limit briefly — acceptable: the
 * downstream sweeper or the next read will surface it, and the operator can
 * choose to grandfather or enforce.
 */
export async function checkLimit(
  orgId: string,
  limit: LimitName,
): Promise<{ ok: boolean; current: number; max: number }> {
  const { plan } = await getOrgPlan(orgId);
  let current = 0;
  let max = 0;

  if (limit === 'contacts') {
    max = plan.maxContacts;
    const [row] = await dbAdmin
      .select({ n: sql<number>`count(*)::int` })
      .from(contact)
      .where(eq(contact.organizationId, orgId));
    current = row?.n ?? 0;
  } else if (limit === 'ig_accounts') {
    max = plan.maxIgAccounts;
    const [row] = await dbAdmin
      .select({ n: sql<number>`count(*)::int` })
      .from(instagramAccount)
      .where(eq(instagramAccount.organizationId, orgId));
    current = row?.n ?? 0;
  } else if (limit === 'operators') {
    max = plan.maxOperators;
    // Count non-viewer members (viewers don't consume an operator seat).
    const [row] = await dbAdmin
      .select({ n: sql<number>`count(*)::int` })
      .from(member)
      .where(and(eq(member.organizationId, orgId), sql`${member.role} <> 'viewer'`));
    current = row?.n ?? 0;
  }

  return { ok: current < max, current, max };
}
