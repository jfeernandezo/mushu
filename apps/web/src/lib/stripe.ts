import Stripe from 'stripe';
import { isHosted } from './mode';

let _stripe: Stripe | null = null;

/**
 * Lazy Stripe client. Only instantiated when first read AND when running in
 * hosted mode — selfhost forks never need a Stripe SDK in memory.
 *
 * Throws on access if hosted mode is on but `STRIPE_SECRET_KEY` is missing.
 * The instrumentation hook should already have crashed the process before
 * we get here (see apps/web/instrumentation.ts), so this is just a defensive
 * guard for callers that bypass the hook (tests, scripts).
 */
export function getStripe(): Stripe {
  if (!isHosted()) {
    throw new Error('[stripe] getStripe called in selfhost mode — guard with isHosted() first');
  }
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('[stripe] STRIPE_SECRET_KEY is not set; cannot create client');
  }
  _stripe = new Stripe(key, {
    // Pin the API version so Stripe schema changes don't surprise us at runtime.
    // Bump when ready to take advantage of new fields.
    apiVersion: '2026-04-22.dahlia',
    typescript: true,
  });
  return _stripe;
}

/**
 * Returns the Stripe Price ID configured for a plan code, or null if the plan
 * doesn't have one (Free). Reads from env so price IDs can rotate without a
 * code deploy — handy when migrating between Stripe test and live modes.
 */
export function priceIdForPlan(planCode: string): string | null {
  if (planCode === 'pro') return process.env.STRIPE_PRICE_ID_PRO ?? null;
  if (planCode === 'agency') return process.env.STRIPE_PRICE_ID_AGENCY ?? null;
  return null;
}
