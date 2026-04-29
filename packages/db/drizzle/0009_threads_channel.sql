-- Adds Threads as a second channel alongside Instagram.
--
-- Strategy: additive — the existing `instagram_account` table becomes the
-- canonical table for both Instagram AND Threads connections, discriminated
-- by the new `channel` column. We don't rename the table because doing so
-- would touch 7 FKs and dozens of queries; the historical name is preserved
-- and a TS-side `account` alias is exported for new code.
--
-- Existing rows are stamped 'instagram' via the column default. New Threads
-- connections insert with channel='threads'.
--
-- The previous unique index (instagram_account_ig_user_id_unique) on
-- (ig_user_id) alone is no longer correct — the same numeric id could
-- theoretically exist on both channels, so the constraint is rebuilt to
-- include channel. In practice IG ids and Threads ids don't collide today,
-- but this is the right shape going forward.

-- 1. Channel column with default 'instagram' so existing rows pick it up.
ALTER TABLE "instagram_account"
  ADD COLUMN IF NOT EXISTS "channel" text NOT NULL DEFAULT 'instagram';

-- 2. Channel value check.
ALTER TABLE "instagram_account"
  DROP CONSTRAINT IF EXISTS "instagram_account_channel_check";
ALTER TABLE "instagram_account"
  ADD CONSTRAINT "instagram_account_channel_check"
  CHECK ("channel" IN ('instagram', 'threads'));

-- 3. Rebuild unique constraint to include channel.
DROP INDEX IF EXISTS "instagram_account_ig_user_id_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "instagram_account_external_user_unique"
  ON "instagram_account" ("channel", "ig_user_id");

-- 4. Filter index for "list accounts of channel X" queries.
CREATE INDEX IF NOT EXISTS "instagram_account_channel_idx"
  ON "instagram_account" ("channel");

-- 5. Extend incoming_event.type to allow Threads-specific event kinds.
-- The column is plain text with no DB-level CHECK constraint today (the
-- Drizzle TS enum is the source of truth), so no DDL is required for the
-- new values. This block is a no-op kept for documentation; if a future
-- migration adds a CHECK constraint, drop+recreate it here.
--   ALTER TABLE "incoming_event"
--     DROP CONSTRAINT IF EXISTS "incoming_event_type_check";
--   ALTER TABLE "incoming_event"
--     ADD CONSTRAINT "incoming_event_type_check"
--     CHECK ("type" IN (... existing values ..., 'threads_reply', 'threads_mention'));
