-- Tenant isolation via Row Level Security.
--
-- Defense-in-depth: even if app code forgets a `WHERE organization_id = ?`,
-- the database refuses to return rows from another workspace. The app sets
-- `app.current_org_id` per transaction (see packages/db/src/with-org.ts);
-- policies key off that GUC.
--
-- Tables that already carry organization_id directly:
--   contact, conversation, flow, flow_execution, instagram_account, notification
--
-- Tables that need a denormalized organization_id (added below):
--   contact_inbox, contact_tag, message, trigger
--
-- NOT covered (intentional):
--   - user, session, account, verification, passkey, organization, member,
--     invitation: managed by Better Auth; user-scoped, not tenant-scoped.
--   - audit_log, incoming_event: append-only, written by trusted server code.
--
-- The policy uses `current_setting('app.current_org_id', true)` — the second
-- arg `true` makes it return NULL (not error) when unset. NULL never equals
-- any text value, so unset = zero rows, which is the safe default.

-- 1) Denormalize organization_id onto child tables -----------------------------

ALTER TABLE "contact_tag" ADD COLUMN "organization_id" text;
UPDATE "contact_tag" ct
   SET "organization_id" = c."organization_id"
  FROM "contact" c
 WHERE c."id" = ct."contact_id";
ALTER TABLE "contact_tag" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "contact_tag"
  ADD CONSTRAINT "contact_tag_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade;
CREATE INDEX "contact_tag_org_idx" ON "contact_tag" USING btree ("organization_id");

ALTER TABLE "contact_inbox" ADD COLUMN "organization_id" text;
UPDATE "contact_inbox" ci
   SET "organization_id" = c."organization_id"
  FROM "contact" c
 WHERE c."id" = ci."contact_id";
ALTER TABLE "contact_inbox" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "contact_inbox"
  ADD CONSTRAINT "contact_inbox_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade;
CREATE INDEX "contact_inbox_org_idx" ON "contact_inbox" USING btree ("organization_id");

ALTER TABLE "message" ADD COLUMN "organization_id" text;
UPDATE "message" m
   SET "organization_id" = c."organization_id"
  FROM "conversation" c
 WHERE c."id" = m."conversation_id";
ALTER TABLE "message" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "message"
  ADD CONSTRAINT "message_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade;
CREATE INDEX "message_org_idx" ON "message" USING btree ("organization_id");

ALTER TABLE "trigger" ADD COLUMN "organization_id" text;
UPDATE "trigger" t
   SET "organization_id" = ia."organization_id"
  FROM "instagram_account" ia
 WHERE ia."id" = t."instagram_account_id";
ALTER TABLE "trigger" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "trigger"
  ADD CONSTRAINT "trigger_organization_id_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade;
CREATE INDEX "trigger_org_idx" ON "trigger" USING btree ("organization_id");

-- 2) Enable RLS + per-table policies ------------------------------------------
--
-- The policy uses the same expression for USING (read/update/delete visibility)
-- and WITH CHECK (insert/update target row): "the row's org must match the GUC."

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'contact',
      'contact_inbox',
      'contact_tag',
      'conversation',
      'flow',
      'flow_execution',
      'instagram_account',
      'message',
      'notification',
      'trigger'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING (organization_id = current_setting(''app.current_org_id'', true)) '
      'WITH CHECK (organization_id = current_setting(''app.current_org_id'', true))',
      t
    );
  END LOOP;
END $$;
