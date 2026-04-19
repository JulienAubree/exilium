-- Track whether a discovered position was explored by the user themselves
-- (vs. acquired via buying an exploration report). Selling an exploration
-- report requires self_explored = true.
ALTER TABLE "discovered_positions"
  ADD COLUMN "self_explored" boolean NOT NULL DEFAULT false;

-- Backfill: existing positions are treated as self-explored. We can't tell
-- apart genuine explorations from purchased reports retroactively, so we
-- default to the non-restrictive value. Handlers enforce the correct flag
-- from now on.
UPDATE "discovered_positions" SET "self_explored" = true;
