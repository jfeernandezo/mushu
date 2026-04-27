-- Track outcome of every transactional email so we can:
--   1. Avoid re-sending to addresses that already bounced (deliverability hygiene)
--   2. Surface "your email bounced" hints in the UI
--   3. Audit which user got which kind of email when (LGPD/SOC2-ish)
--
-- Status values:
--   sent      = transporter accepted; downstream NDR may still arrive
--   bounced   = SMTP 5xx OR NDR ingested
--   deferred  = SMTP 4xx; transient — caller may retry
--
-- We do not store the email body. Subject is enough for ops debugging.

CREATE TABLE IF NOT EXISTS "email_delivery" (
  "id" text PRIMARY KEY NOT NULL,
  "recipient_email" text NOT NULL,
  "message_type" text NOT NULL,
  "status" text NOT NULL,
  "subject" text,
  "smtp_response" text,
  "error_message" text,
  "sent_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Used by the pre-send check: "has this address bounced ≥3 times in the last
-- 30 days?" The (lowercased recipient_email, status) pair is the natural index.
CREATE INDEX IF NOT EXISTS "email_delivery_recipient_status_idx"
  ON "email_delivery" (lower("recipient_email"), "status");

CREATE INDEX IF NOT EXISTS "email_delivery_sent_at_idx"
  ON "email_delivery" ("sent_at");
