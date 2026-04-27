-- Index on incoming_event.created_at to make the daily retention sweeper fast.
-- Without it, "DELETE WHERE created_at < now() - 90 days" does a full scan and
-- ties up the table — fine for a 10k-row dev DB, painful on millions.
--
-- IF NOT EXISTS lets this migration be re-run idempotently if pulled into a
-- branch that already has it.

CREATE INDEX IF NOT EXISTS "incoming_event_created_at_idx"
  ON "incoming_event" ("created_at");
