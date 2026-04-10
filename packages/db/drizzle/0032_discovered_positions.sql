-- Per-player record of which positions have been explored or colonized
CREATE TABLE "discovered_positions" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "galaxy" smallint NOT NULL,
  "system" smallint NOT NULL,
  "position" smallint NOT NULL,
  PRIMARY KEY ("user_id", "galaxy", "system", "position")
);

CREATE INDEX "discovered_positions_user_idx" ON "discovered_positions" ("user_id", "galaxy", "system");

-- Backfill: every colonized planet position is automatically discovered for its owner
INSERT INTO "discovered_positions" ("user_id", "galaxy", "system", "position")
SELECT DISTINCT "user_id", "galaxy", "system", "position" FROM "planets"
ON CONFLICT DO NOTHING;

-- Backfill: every position with at least one discovered biome is discovered
INSERT INTO "discovered_positions" ("user_id", "galaxy", "system", "position")
SELECT DISTINCT "user_id", "galaxy", "system", "position" FROM "discovered_biomes"
ON CONFLICT DO NOTHING;
