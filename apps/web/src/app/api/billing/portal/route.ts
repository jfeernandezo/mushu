import { dbAdmin, member as memberTable } from '@mushu/db';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isHosted } from '@/lib/mode';
import { requirePermission } from '@/lib/permissions';
import { getOrgPlan } from '@/lib/plan';
import { getStripe } from '@/lib/stripe';

/**
 * Creates a Stripe Customer Portal session for managing the active org's
 * subscription (cancel, change plan, update card, download invoices).
 *
 * Returns the portal URL the browser should redirect to.
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
  if (!me) return NextResponse.json({ error: 'not_a_member' }, { status: 403 });
  try {
    await requirePermission(me.id, 'billing.manage');
  } catch {
    return NextResponse.json({ error: 'permission_denied' }, { status: 403 });
  }

  const { subscription } = await getOrgPlan(orgId);
  if (!subscription.stripeCustomerId) {
    // Org has no Stripe customer yet — they're on Free and never checked out.
    // Send them to the pricing page instead of blowing up.
    return NextResponse.json({ error: 'no_stripe_customer' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/settings/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
