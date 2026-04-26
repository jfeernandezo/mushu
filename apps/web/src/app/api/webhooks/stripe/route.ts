import { dbAdmin, plan as planTable, subscription as subscriptionTable } from '@mushu/db';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { isHosted } from '@/lib/mode';
import { getStripe } from '@/lib/stripe';

/**
 * Stripe webhook receiver. Stripe calls this with subscription / invoice
 * events; we sync the local `subscription` row to match.
 *
 * Required events on the Stripe webhook config:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 *
 * The handler MUST return 2xx fast. If we ever do heavy work, push it to a
 * BullMQ job and ack here.
 */
export async function POST(req: NextRequest) {
  if (!isHosted()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Should never reach here — instrumentation hook crashes boot if missing.
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 500 });
  }

  // Stripe needs the raw body to verify the signature; can't use req.json().
  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await markCanceled(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await markPastDue(event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event types are fine; Stripe doesn't retry them.
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] handler error', {
      type: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    // Return 500 so Stripe retries with backoff.
    return NextResponse.json({ error: 'handler_error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(s: Stripe.Subscription): Promise<void> {
  const orgId = s.metadata?.organizationId;
  if (!orgId) {
    console.error('[stripe webhook] subscription has no organizationId metadata', { id: s.id });
    return;
  }

  // Look up which local plan this Stripe price maps to. Stripe always sends
  // back the price id as the first item of the subscription.
  const stripePriceId = s.items.data[0]?.price.id ?? null;
  let planCode: string | null = null;
  if (stripePriceId) {
    const [p] = await dbAdmin
      .select({ code: planTable.code })
      .from(planTable)
      .where(eq(planTable.stripePriceId, stripePriceId))
      .limit(1);
    planCode = p?.code ?? null;
  }
  if (!planCode) {
    console.error('[stripe webhook] no local plan matches Stripe price', {
      orgId,
      stripePriceId,
    });
    return;
  }

  const previous = await dbAdmin
    .select({ planCode: subscriptionTable.planCode, status: subscriptionTable.status })
    .from(subscriptionTable)
    .where(eq(subscriptionTable.organizationId, orgId))
    .limit(1);

  await dbAdmin
    .update(subscriptionTable)
    .set({
      planCode,
      stripeSubscriptionId: s.id,
      stripeCustomerId: typeof s.customer === 'string' ? s.customer : s.customer.id,
      status: mapStripeStatus(s.status),
      currentPeriodStart: toDate(s.items.data[0]?.current_period_start),
      currentPeriodEnd: toDate(s.items.data[0]?.current_period_end),
      cancelAtPeriodEnd: s.cancel_at_period_end,
      trialEnd: toDate(s.trial_end),
      updatedAt: new Date(),
    })
    .where(eq(subscriptionTable.organizationId, orgId));

  if (previous[0] && previous[0].planCode !== planCode) {
    await recordAudit({
      orgId,
      actorUserId: null,
      action: AUDIT_ACTIONS.BILLING_PLAN_CHANGED,
      targetType: 'subscription',
      targetId: s.id,
      metadata: {
        from: previous[0].planCode,
        to: planCode,
        status: s.status,
      },
    });
  }
}

async function markCanceled(s: Stripe.Subscription): Promise<void> {
  const orgId = s.metadata?.organizationId;
  if (!orgId) return;

  // Subscription deleted = downgrade back to Free immediately. Stripe sends
  // this AFTER the period ends when cancel_at_period_end is true, so by the
  // time we land here it's the right moment to revoke access.
  await dbAdmin
    .update(subscriptionTable)
    .set({
      planCode: 'free',
      status: 'canceled',
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionTable.organizationId, orgId));

  await recordAudit({
    orgId,
    actorUserId: null,
    action: AUDIT_ACTIONS.BILLING_SUBSCRIPTION_CANCELED,
    targetType: 'subscription',
    targetId: s.id,
  });
}

async function markPastDue(invoice: Stripe.Invoice): Promise<void> {
  // Some invoices have a string subscription id, others nest the object.
  // We only care about subscription invoices, not one-off charges.
  const subId = typeof invoice.parent?.subscription_details?.subscription === 'string'
    ? invoice.parent.subscription_details.subscription
    : null;
  if (!subId) return;

  await dbAdmin
    .update(subscriptionTable)
    .set({ status: 'past_due', updatedAt: new Date() })
    .where(eq(subscriptionTable.stripeSubscriptionId, subId));
}

function mapStripeStatus(s: Stripe.Subscription.Status): SubStatus {
  // Stripe statuses we want to keep verbatim
  switch (s) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
    case 'unpaid':
      return s;
    case 'incomplete_expired':
      return 'canceled';
    case 'paused':
      return 'past_due';
    default:
      return 'active';
  }
}

type SubStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid';

function toDate(unix: number | null | undefined): Date | null {
  return unix ? new Date(unix * 1000) : null;
}
