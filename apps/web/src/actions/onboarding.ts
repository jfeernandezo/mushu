'use server';

import {
  db,
  flow,
  incomingEvent,
  instagramAccount,
  user as userTable,
  withOrgTx,
} from '@mushu/db';
import { and, count, eq, sql } from 'drizzle-orm';
import { headers as nextHeaders } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

export interface OnboardingState {
  /** True iff user verified the email address used at signup. */
  hasVerifiedEmail: boolean;
  /** True iff at least one Instagram account is connected to the active org. */
  hasIgAccount: boolean;
  /** True iff at least one flow (draft or published) exists. */
  hasFlow: boolean;
  /** True iff at least one published flow exists in the org. */
  hasPublishedFlow: boolean;
  /** True iff the org received at least one webhook event from Meta. */
  hasReceivedEvent: boolean;
  /** Operator chose to hide the checklist forever. We respect the choice
   *  even if items are still pending. */
  dismissed: boolean;
  /** Sum of true booleans above (excluding `dismissed`) — UI uses this to
   *  decide when to auto-hide. */
  completedCount: number;
  totalCount: number;
}

/**
 * Build the onboarding state for the current user + active org. Cheap reads
 * (3 indexed counts) — fine to call on every dashboard render. Returns
 * everything dismissed/empty when there's no active org so the dashboard's
 * empty state still renders without errors.
 */
export async function getOnboardingState(): Promise<OnboardingState> {
  const empty: OnboardingState = {
    hasVerifiedEmail: false,
    hasIgAccount: false,
    hasFlow: false,
    hasPublishedFlow: false,
    hasReceivedEvent: false,
    dismissed: true,
    completedCount: 0,
    totalCount: 5,
  };

  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session) return empty;
    const orgId = session.session.activeOrganizationId;
    if (!orgId) return empty;

    const [userRow] = await db
      .select({
        emailVerified: userTable.emailVerified,
        additionalAttributes: userTable.additionalAttributes,
      })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .limit(1);

    const dismissed =
      ((userRow?.additionalAttributes as Record<string, unknown> | null) ?? {})[
        'onboardingDismissed'
      ] === true;

    const counts = await withOrgTx(orgId, async (tx) => {
      const [igRow] = await tx
        .select({ n: count() })
        .from(instagramAccount)
        .where(eq(instagramAccount.organizationId, orgId));
      const [flowRow] = await tx
        .select({ n: count() })
        .from(flow)
        .where(eq(flow.organizationId, orgId));
      const [publishedRow] = await tx
        .select({ n: count() })
        .from(flow)
        .where(and(eq(flow.organizationId, orgId), eq(flow.isEnabled, true)));
      // Webhook events are stored without an org_id column directly; we join
      // through instagram_account. Use an EXISTS to avoid pulling rows.
      const [eventRow] = await tx
        .select({ n: count() })
        .from(incomingEvent)
        .where(
          sql`${incomingEvent.instagramAccountId} IN (
            SELECT id FROM instagram_account WHERE organization_id = ${orgId}
          )`,
        );
      return {
        ig: Number(igRow?.n ?? 0),
        flows: Number(flowRow?.n ?? 0),
        published: Number(publishedRow?.n ?? 0),
        events: Number(eventRow?.n ?? 0),
      };
    });

    const hasVerifiedEmail = userRow?.emailVerified === true;
    const hasIgAccount = counts.ig > 0;
    const hasFlow = counts.flows > 0;
    const hasPublishedFlow = counts.published > 0;
    const hasReceivedEvent = counts.events > 0;

    const completedCount = [
      hasVerifiedEmail,
      hasIgAccount,
      hasFlow,
      hasPublishedFlow,
      hasReceivedEvent,
    ].filter(Boolean).length;

    return {
      hasVerifiedEmail,
      hasIgAccount,
      hasFlow,
      hasPublishedFlow,
      hasReceivedEvent,
      dismissed,
      completedCount,
      totalCount: 5,
    };
  } catch {
    return empty;
  }
}

/**
 * Persist a "hide forever" choice in `user.additional_attributes`. Uses jsonb
 * `||` merge so other future flags aren't clobbered. Idempotent.
 */
export async function dismissOnboarding(): Promise<{ ok: boolean }> {
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    if (!session) return { ok: false };
    await db
      .update(userTable)
      .set({
        additionalAttributes: sql`${userTable.additionalAttributes} || ${JSON.stringify({ onboardingDismissed: true })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, session.user.id));
    revalidatePath('/dashboard');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
