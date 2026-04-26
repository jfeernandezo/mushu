'use server';

import {
  dbAdmin,
  member as memberTable,
  permission,
  permissionGroup,
  permissionGroupPermission,
  plan as planTable,
  planPermissionGroup,
} from '@mushu/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';
import { auth } from '@/lib/auth';
import { isHosted } from '@/lib/mode';
import { hasPermission } from '@/lib/permissions';
import { getOrgPlan } from '@/lib/plan';

export interface PublicPlan {
  code: string;
  name: string;
  priceBrlCents: number;
  maxContacts: number;
  maxIgAccounts: number;
  maxOperators: number;
  /** Plain-language permission descriptions unlocked by this plan. */
  features: string[];
  /** True if this plan can be purchased via checkout (has a Stripe price). */
  purchasable: boolean;
}

/**
 * Lists every listed plan with its features expanded for display on /pricing.
 * Reads global catalog tables (no RLS), so works in any context.
 */
export async function listPublicPlans(): Promise<PublicPlan[]> {
  const plans = await dbAdmin
    .select({
      code: planTable.code,
      name: planTable.name,
      displayOrder: planTable.displayOrder,
      priceBrlCents: planTable.priceBrlCents,
      maxContacts: planTable.maxContacts,
      maxIgAccounts: planTable.maxIgAccounts,
      maxOperators: planTable.maxOperators,
      stripePriceId: planTable.stripePriceId,
    })
    .from(planTable)
    .where(eq(planTable.isListed, true))
    .orderBy(asc(planTable.displayOrder));

  // For each plan, expand its permission groups -> permissions -> descriptions.
  // One round-trip total: gather all groups, then all permissions, then assemble.
  const planCodes = plans.map((p) => p.code);
  const groupRows = planCodes.length
    ? await dbAdmin
        .select({
          planCode: planPermissionGroup.planCode,
          groupCode: planPermissionGroup.groupCode,
        })
        .from(planPermissionGroup)
        .where(inArray(planPermissionGroup.planCode, planCodes))
    : [];

  const groupCodes = Array.from(new Set(groupRows.map((g) => g.groupCode)));
  const permRows = groupCodes.length
    ? await dbAdmin
        .select({
          groupCode: permissionGroupPermission.groupCode,
          permissionCode: permissionGroupPermission.permissionCode,
          description: permission.description,
          scope: permission.scope,
        })
        .from(permissionGroupPermission)
        .innerJoin(
          permission,
          eq(permission.code, permissionGroupPermission.permissionCode),
        )
        .where(inArray(permissionGroupPermission.groupCode, groupCodes))
    : [];

  return plans.map((p) => {
    const groupCodesForPlan = groupRows
      .filter((g) => g.planCode === p.code)
      .map((g) => g.groupCode);
    const features = permRows
      .filter((pr) => groupCodesForPlan.includes(pr.groupCode) && pr.scope === 'feature')
      .map((pr) => pr.description);
    return {
      code: p.code,
      name: p.name,
      priceBrlCents: p.priceBrlCents,
      maxContacts: p.maxContacts,
      maxIgAccounts: p.maxIgAccounts,
      maxOperators: p.maxOperators,
      features,
      purchasable: !!p.stripePriceId,
    };
  });
}

export interface CurrentSubscription {
  planCode: string;
  planName: string;
  priceBrlCents: number;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
}

/**
 * Returns the active subscription's display state for the user's current org.
 * Used by /settings/billing. 401-equivalent if no session.
 */
export async function getMySubscription(): Promise<
  { ok: true; data: CurrentSubscription } | { ok: false; error: string }
> {
  if (!isHosted()) return { ok: false, error: 'not_hosted' };
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session) return { ok: false, error: 'unauthenticated' };
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return { ok: false, error: 'no_active_org' };

    const { plan, subscription } = await getOrgPlan(orgId);
    return {
      ok: true,
      data: {
        planCode: plan.code,
        planName: plan.name,
        priceBrlCents: plan.priceBrlCents,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        hasStripeCustomer: !!subscription.stripeCustomerId,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown_error' };
  }
}

/**
 * Tells the billing UI whether the current user can manage billing — drives
 * whether the upgrade buttons / portal link render.
 */
export async function canManageBilling(): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session) return false;
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return false;
    const [me] = await dbAdmin
      .select({ id: memberTable.id })
      .from(memberTable)
      .where(and(eq(memberTable.userId, session.user.id), eq(memberTable.organizationId, orgId)))
      .limit(1);
    if (!me) return false;
    return hasPermission(me.id, 'billing.manage');
  } catch {
    return false;
  }
}

// Suppress unused-import warning when permissionGroup is only kept for clarity
// in the schema graph above.
void permissionGroup;
