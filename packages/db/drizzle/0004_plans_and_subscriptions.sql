-- Plans + subscriptions. The "capability layer" that sits next to the
-- workspace permission layer from migration 0003.
--
-- A `plan` row defines the limits and the permission groups the org gets.
-- A `subscription` row links one organization to one plan and tracks Stripe
-- state (when MUSHU_MODE=hosted). In selfhost mode every org has a Free
-- subscription with stripe_* columns NULL — Stripe is never consulted.
--
-- Plan-derived permission groups feed back into the hasPermission resolver
-- (apps/web/src/lib/permissions.ts) via a UNION across the three sources
-- now defined: member groups, role groups, plan groups.

CREATE TABLE "plan" (
  "code" text PRIMARY KEY,                       -- 'free' | 'pro' | 'agency'
  "name" text NOT NULL,
  "display_order" integer NOT NULL,
  "price_brl_cents" integer NOT NULL DEFAULT 0,  -- 0, 9700, 19700
  "stripe_price_id" text,                        -- null for free
  -- Limits as columns (numeric values don't fit cleanly into the permission
  -- system; making them queryable here keeps "do I have headroom?" cheap).
  "max_contacts" integer NOT NULL,
  "max_ig_accounts" integer NOT NULL,
  "max_operators" integer NOT NULL,
  "is_listed" boolean NOT NULL DEFAULT true,    -- false = legacy/grandfathered
  "created_at" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "plan"
  ("code", "name", "display_order", "price_brl_cents", "max_contacts", "max_ig_accounts", "max_operators")
VALUES
  ('free', 'Free', 1, 0, 1000, 1, 1),
  ('pro', 'Pro', 2, 9700, 10000, 3, 3),
  ('agency', 'Agency', 3, 19700, 50000, 15, 10);

CREATE TABLE "plan_permission_group" (
  "plan_code" text NOT NULL REFERENCES "plan"("code") ON DELETE cascade,
  "group_code" text NOT NULL REFERENCES "permission_group"("code") ON DELETE cascade,
  PRIMARY KEY ("plan_code", "group_code")
);

INSERT INTO "plan_permission_group" ("plan_code", "group_code") VALUES
  ('free', 'plan_free_features'),
  ('pro', 'plan_pro_features'),
  ('agency', 'plan_agency_features');

CREATE TABLE "subscription" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL UNIQUE REFERENCES "organization"("id") ON DELETE cascade,
  "plan_code" text NOT NULL REFERENCES "plan"("code"),
  -- Stripe state. NULL when org is on Free or running in selfhost mode.
  "stripe_customer_id" text UNIQUE,
  "stripe_subscription_id" text UNIQUE,
  -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'
  "status" text NOT NULL DEFAULT 'active',
  "current_period_start" timestamp,
  "current_period_end" timestamp,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "trial_end" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "subscription_org_idx" ON "subscription" ("organization_id");
CREATE INDEX "subscription_status_idx" ON "subscription" ("status");

-- Backfill: every existing org (created before billing existed) gets a Free
-- subscription so the resolver never sees an org without one.
INSERT INTO "subscription" ("id", "organization_id", "plan_code")
  SELECT gen_random_uuid()::text, "id", 'free'
    FROM "organization"
   WHERE "id" NOT IN (SELECT "organization_id" FROM "subscription");

-- RLS: subscription is tenant-scoped (per org). The catalog tables (plan,
-- plan_permission_group) are global — every tenant reads the same plan list.
ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription"
  USING (organization_id = current_setting('app.current_org_id', true))
  WITH CHECK (organization_id = current_setting('app.current_org_id', true));
