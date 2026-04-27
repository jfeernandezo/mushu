-- Generic key-value bag on `user` for small UX flags that don't deserve their
-- own column. First consumer (Sprint E.4):
--   { "onboardingDismissed": true }   — hides the post-signup checklist
--
-- Keep ad-hoc — anything that hits 5+ writes/day or needs a query (`WHERE
-- attr->>'foo' = 'bar'`) should graduate to its own column.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "additional_attributes" jsonb NOT NULL DEFAULT '{}'::jsonb;
