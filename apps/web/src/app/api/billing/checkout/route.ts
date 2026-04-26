import { dbAdmin, member as memberTable, subscription as subscriptionTable } from '@mushu/db';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { isHosted } from '@/lib/mode';
import { requirePermission } from '@/lib/permissions';
import { ensureSubscription, getOrgPlan } from '@/lib/plan';
import { getStripe, priceIdForPlan } from '@/lib/stripe';

const bodySchema = z.object({
  planCode: z.enum(['pro', 'agency']),
});

/**
 * Creates a Stripe Checkout Session for upgrading the active org's plan.
 * Returns the URL the browser should redirect to.
 *
 * Security model:
 *   - Requires an authenticated session
 *   - Requires `billing.manage` permission on the active org
 *   - 404s in selfhost mode (Stripe is not even imported)
 */
export async function POST(req: NextRequest) {
  if (!isHosted()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    return NextResponse.json({ error: 'no_active_org' }, { status: 400 });
  }

  const [me] = await dbAdmin
    .select({ id: memberTable.id })
    .from(memberTable)
    .where(and(eq(memberTable.userId, session.user.id), eq(memberTable.organizationId, orgId)))
    .limit(1);
  if (!me) {
    return NextResponse.json({ error: 'not_a_member' }, { status: 403 });
  }
  try {
    await requirePermission(me.id, 'billing.manage');
  } catch {
    return NextResponse.json({ error: 'permission_denied' }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const priceId = priceIdForPlan(body.planCode);
  if (!priceId) {
    return NextResponse.json({ error: 'plan_not_purchasable' }, { status: 400 });
  }

  const subscription = await ensureSubscription(orgId);
  const stripe = getStripe();

  // Reuse the existing customer if we have one. This keeps invoices/payment
  // methods stitched to the same Customer across plan changes.
  let customerId = subscription.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name,
      metadata: {
        organizationId: orgId,
        userId: session.user.id,
      },
    });
    customerId = customer.id;
    await dbAdmin
      .update(subscriptionTable)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(subscriptionTable.id, subscription.id));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings/billing?status=success`,
    cancel_url: `${appUrl}/settings/billing?status=cancelled`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        organizationId: orgId,
        planCode: body.planCode,
      },
    },
    metadata: {
      organizationId: orgId,
      planCode: body.planCode,
    },
  });

  await recordAudit({
    orgId,
    actorUserId: session.user.id,
    action: AUDIT_ACTIONS.BILLING_CHECKOUT_STARTED,
    targetType: 'subscription',
    targetId: subscription.id,
    metadata: { planCode: body.planCode, stripeSessionId: checkout.id },
  });

  if (!checkout.url) {
    return NextResponse.json({ error: 'stripe_no_url' }, { status: 500 });
  }
  return NextResponse.json({ url: checkout.url });
}
