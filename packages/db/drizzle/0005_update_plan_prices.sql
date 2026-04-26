-- Update plan prices to the launch pricing decided 2026-04-26.
-- Pro: R$ 197,00 / Agency: R$ 597,00. Free remains R$ 0.
-- See docs/PRICING_TIERS.md for the full pricing rationale.
--
-- Note: stripe_price_id is not touched here. Price IDs are read from env vars
-- (STRIPE_PRICE_ID_PRO / STRIPE_PRICE_ID_AGENCY) at runtime by
-- priceIdForPlan() in apps/web/src/lib/stripe.ts — the column is metadata
-- only and not consulted by the billing flow. Keep the env in sync with the
-- prices set in Stripe Dashboard.

UPDATE "plan" SET "price_brl_cents" = 19700 WHERE "code" = 'pro';
UPDATE "plan" SET "price_brl_cents" = 59700 WHERE "code" = 'agency';
