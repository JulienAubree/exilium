-- Lot 1 : Stockage normalisé des niveaux de recherche (wide → lignes)
-- Crée la table user_research_levels et backfille depuis user_research.
-- Idempotent : ON CONFLICT DO NOTHING. user_research est CONSERVÉE.

CREATE TABLE IF NOT EXISTS "user_research_levels" (
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"research_id" varchar(64) NOT NULL,
	"level" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "user_research_levels_pkey" PRIMARY KEY("user_id","research_id")
);
--> statement-breakpoint

-- Backfill depuis user_research vers user_research_levels.
-- Une ligne par (user_id, research_id) pour chacune des 21 recherches.
-- ON CONFLICT DO NOTHING garantit l'idempotence.

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'espionageTech', "espionage_tech" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'computerTech', "computer_tech" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'energyTech', "energy_tech" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'combustion', "combustion" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'impulse', "impulse" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'hyperspaceDrive', "hyperspace_drive" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'weapons', "weapons" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'shielding', "shielding" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'armor', "armor" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'rockFracturing', "rock_fracturing" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'deepSpaceRefining', "deep_space_refining" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'sensorNetwork', "sensor_network" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'stealthTech', "stealth_tech" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'semiconductors', "semiconductors" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'armoredStorage', "armored_storage" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'planetaryExploration', "planetary_exploration" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'volcanicWeaponry', "volcanic_weaponry" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'aridArmor', "arid_armor" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'temperateProduction', "temperate_production" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'glacialShielding', "glacial_shielding" FROM "user_research"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "user_research_levels" ("user_id", "research_id", "level")
SELECT "user_id", 'gaseousPropulsion', "gaseous_propulsion" FROM "user_research"
ON CONFLICT DO NOTHING;
