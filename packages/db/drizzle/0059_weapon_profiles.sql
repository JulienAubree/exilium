ALTER TABLE "ship_definitions"
  ADD COLUMN "weapon_profiles" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "defense_definitions"
  ADD COLUMN "weapon_profiles" jsonb NOT NULL DEFAULT '[]'::jsonb;
