-- Drop rapid_fire table
ALTER TABLE "rapid_fire" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "rapid_fire" CASCADE;--> statement-breakpoint

-- Rename armor → hull in ship_definitions and defense_definitions
ALTER TABLE "ship_definitions" RENAME COLUMN "armor" TO "hull";--> statement-breakpoint
ALTER TABLE "defense_definitions" RENAME COLUMN "armor" TO "hull";--> statement-breakpoint

-- Add new combat columns to ship_definitions
ALTER TABLE "ship_definitions" ADD COLUMN "base_armor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ship_definitions" ADD COLUMN "shot_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ship_definitions" ADD COLUMN "combat_category_id" varchar(64);--> statement-breakpoint

-- Add new combat columns to defense_definitions
ALTER TABLE "defense_definitions" ADD COLUMN "base_armor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "defense_definitions" ADD COLUMN "shot_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "defense_definitions" ADD COLUMN "combat_category_id" varchar(64);--> statement-breakpoint

-- Rename ship columns in planet_ships
ALTER TABLE "planet_ships" RENAME COLUMN "light_fighter" TO "interceptor";--> statement-breakpoint
ALTER TABLE "planet_ships" RENAME COLUMN "heavy_fighter" TO "frigate";--> statement-breakpoint
ALTER TABLE "planet_ships" RENAME COLUMN "battleship" TO "battlecruiser";--> statement-breakpoint

-- Rename defense column in planet_defenses
ALTER TABLE "planet_defenses" RENAME COLUMN "gauss_cannon" TO "electromagnetic_cannon";--> statement-breakpoint

-- Add target_priority to fleet_events
ALTER TABLE "fleet_events" ADD COLUMN "target_priority" varchar(64);--> statement-breakpoint

-- ── JSONB key renames: lightFighter→interceptor, heavyFighter→frigate, battleship→battlecruiser, gaussCannon→electromagneticCannon ──

-- fleet_events.ships
UPDATE "fleet_events" SET ships = ships - 'lightFighter' || jsonb_build_object('interceptor', ships->'lightFighter') WHERE ships ? 'lightFighter';--> statement-breakpoint
UPDATE "fleet_events" SET ships = ships - 'heavyFighter' || jsonb_build_object('frigate', ships->'heavyFighter') WHERE ships ? 'heavyFighter';--> statement-breakpoint
UPDATE "fleet_events" SET ships = ships - 'battleship' || jsonb_build_object('battlecruiser', ships->'battleship') WHERE ships ? 'battleship';--> statement-breakpoint
UPDATE "fleet_events" SET ships = ships - 'gaussCannon' || jsonb_build_object('electromagneticCannon', ships->'gaussCannon') WHERE ships ? 'gaussCannon';--> statement-breakpoint

-- mission_reports.fleet.ships
UPDATE "mission_reports" SET fleet = jsonb_set(fleet, '{ships}', (fleet->'ships') - 'lightFighter' || jsonb_build_object('interceptor', fleet->'ships'->'lightFighter')) WHERE fleet->'ships' ? 'lightFighter';--> statement-breakpoint
UPDATE "mission_reports" SET fleet = jsonb_set(fleet, '{ships}', (fleet->'ships') - 'heavyFighter' || jsonb_build_object('frigate', fleet->'ships'->'heavyFighter')) WHERE fleet->'ships' ? 'heavyFighter';--> statement-breakpoint
UPDATE "mission_reports" SET fleet = jsonb_set(fleet, '{ships}', (fleet->'ships') - 'battleship' || jsonb_build_object('battlecruiser', fleet->'ships'->'battleship')) WHERE fleet->'ships' ? 'battleship';--> statement-breakpoint
UPDATE "mission_reports" SET fleet = jsonb_set(fleet, '{ships}', (fleet->'ships') - 'gaussCannon' || jsonb_build_object('electromagneticCannon', fleet->'ships'->'gaussCannon')) WHERE fleet->'ships' ? 'gaussCannon';--> statement-breakpoint

-- mission_reports.result — rename keys in nested JSONB objects
-- Helper function to rename keys in a JSONB object
CREATE OR REPLACE FUNCTION _rename_jsonb_keys(obj jsonb) RETURNS jsonb AS $$
DECLARE
  renames jsonb := '{"lightFighter":"interceptor","heavyFighter":"frigate","battleship":"battlecruiser","gaussCannon":"electromagneticCannon"}';
  old_key text;
  new_key text;
BEGIN
  IF obj IS NULL OR jsonb_typeof(obj) != 'object' THEN RETURN obj; END IF;
  FOR old_key, new_key IN SELECT * FROM jsonb_each_text(renames) LOOP
    IF obj ? old_key THEN
      obj := (obj - old_key) || jsonb_build_object(new_key, obj->old_key);
    END IF;
  END LOOP;
  RETURN obj;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

UPDATE "mission_reports" SET result =
  result
    || CASE WHEN result ? 'attackerFleet' THEN jsonb_build_object('attackerFleet', _rename_jsonb_keys(result->'attackerFleet')) ELSE '{}'::jsonb END
    || CASE WHEN result ? 'defenderFleet' THEN jsonb_build_object('defenderFleet', _rename_jsonb_keys(result->'defenderFleet')) ELSE '{}'::jsonb END
    || CASE WHEN result ? 'defenderDefenses' THEN jsonb_build_object('defenderDefenses', _rename_jsonb_keys(result->'defenderDefenses')) ELSE '{}'::jsonb END
    || CASE WHEN result ? 'attackerLosses' THEN jsonb_build_object('attackerLosses', _rename_jsonb_keys(result->'attackerLosses')) ELSE '{}'::jsonb END
    || CASE WHEN result ? 'defenderLosses' THEN jsonb_build_object('defenderLosses', _rename_jsonb_keys(result->'defenderLosses')) ELSE '{}'::jsonb END
    || CASE WHEN result ? 'attackerSurvivors' THEN jsonb_build_object('attackerSurvivors', _rename_jsonb_keys(result->'attackerSurvivors')) ELSE '{}'::jsonb END
    || CASE WHEN result ? 'defenderSurvivors' THEN jsonb_build_object('defenderSurvivors', _rename_jsonb_keys(result->'defenderSurvivors')) ELSE '{}'::jsonb END
    || CASE WHEN result ? 'repairedDefenses' THEN jsonb_build_object('repairedDefenses', _rename_jsonb_keys(result->'repairedDefenses')) ELSE '{}'::jsonb END
WHERE mission_type IN ('attack', 'pirate');--> statement-breakpoint

-- Rename keys inside rounds array
UPDATE "mission_reports" SET result = jsonb_set(result, '{rounds}', (
  SELECT coalesce(jsonb_agg(
    r || jsonb_build_object('attackerShips', _rename_jsonb_keys(r->'attackerShips'))
      || jsonb_build_object('defenderShips', _rename_jsonb_keys(r->'defenderShips'))
  ), '[]'::jsonb)
  FROM jsonb_array_elements(result->'rounds') AS r
))
WHERE mission_type IN ('attack', 'pirate') AND result ? 'rounds' AND jsonb_typeof(result->'rounds') = 'array';--> statement-breakpoint

-- Cleanup helper function
DROP FUNCTION IF EXISTS _rename_jsonb_keys(jsonb);
