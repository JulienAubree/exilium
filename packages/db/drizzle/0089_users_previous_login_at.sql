-- Snapshot of the previous login time, used by the "absence summary" feature.
-- Updated on login/refresh only when the gap since `last_login_at` exceeds
-- the absence threshold, so it always represents the start of the *previous
-- session* (not the last token refresh).
BEGIN;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "previous_login_at" timestamp WITH TIME ZONE;

COMMIT;
