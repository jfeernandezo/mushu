/**
 * Distinguishes the *operating mode* of this Mushu deployment.
 *
 * `selfhost` (default): a fork running on the operator's own infra. No billing,
 * no Stripe — every paid feature is unlocked, no plan checks gate the UI. The
 * pricing page and `/settings/billing` 404 because they don't apply.
 *
 * `hosted`: an instance that monetises via Stripe subscriptions. Pricing page
 * is public, signup creates a Free subscription, paid features gate behind
 * `org.hasFeature(...)`, and billing pages are reachable.
 *
 * The mode is set via `MUSHU_MODE` env var. Anything other than the literal
 * string `'hosted'` is treated as `selfhost` so a missing env (the typical
 * fork case) fails open in the safer direction.
 *
 * Use `isHosted()` / `isSelfHost()` rather than reading the env directly so
 * future changes (e.g. per-org overrides for testing) have one place to land.
 */
export type MushuMode = 'hosted' | 'selfhost';

export function getMode(): MushuMode {
  return process.env.MUSHU_MODE === 'hosted' ? 'hosted' : 'selfhost';
}

export function isHosted(): boolean {
  return getMode() === 'hosted';
}

export function isSelfHost(): boolean {
  return getMode() === 'selfhost';
}

/**
 * Env vars required when `MUSHU_MODE=hosted`. Validated at startup by
 * [instrumentation.ts](../../instrumentation.ts) — a missing var there
 * crashes the app loud and early instead of producing broken Stripe calls
 * at request time.
 */
export const HOSTED_REQUIRED_ENV = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PRO',
  'STRIPE_PRICE_ID_AGENCY',
] as const;
