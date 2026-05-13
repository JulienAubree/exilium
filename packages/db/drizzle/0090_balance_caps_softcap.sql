-- Sprint 1 of the 5-pillar rebalance roadmap : plafonds & soft-caps.
-- Adds the structural columns required to mark bonuses as asymptotic
-- (with a softCap target + k) and to cap buildings at a maxLevel.
--
-- Storage cap is handled in code (effective = min(theoretical, X × hourly))
-- so no schema change there.
BEGIN;

-- 1. max_level on building_definitions (mirror of research_definitions).
--    When NULL the building has no hard cap (legacy behavior).
ALTER TABLE "building_definitions"
  ADD COLUMN IF NOT EXISTS "max_level" smallint;

-- 2. bonus type metadata for the asymptotic soft-cap.
--    bonus_type='linear' keeps the existing `1 + (percentPerLevel/100) × level`
--    bonus_type='asymptotic' applies `softCapMax × (1 - exp(-softCapK × level))`
--    so the bonus tends to softCapMax without ever crossing it.
ALTER TABLE "bonus_definitions"
  ADD COLUMN IF NOT EXISTS "bonus_type" varchar(16) NOT NULL DEFAULT 'linear';

ALTER TABLE "bonus_definitions"
  ADD COLUMN IF NOT EXISTS "soft_cap_max" real;

ALTER TABLE "bonus_definitions"
  ADD COLUMN IF NOT EXISTS "soft_cap_k" real;

-- 3. universe_config entry for the storage cap factor (hours of production).
--    24 means storage caps at 24 × hourly_production — a player away for a
--    full day doesn't lose anything. Tweakable per server.
INSERT INTO "universe_config" ("key", "value")
VALUES ('storage_cap_hours_factor', '24'::jsonb)
ON CONFLICT ("key") DO NOTHING;

COMMIT;
