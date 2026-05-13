-- Fleet composition presets per user.
-- A preset stores a {shipId: count} JSON map that the player can save once
-- and reload later from the Fleet page. Not tied to a planet or a mission —
-- pure composition recipe.
BEGIN;

CREATE TABLE IF NOT EXISTS "fleet_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(64) NOT NULL,
  "ships" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  "updated_at" timestamp WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "fleet_presets_user_id_idx" ON "fleet_presets" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "fleet_presets_user_name_idx" ON "fleet_presets" ("user_id", "name");

COMMIT;
