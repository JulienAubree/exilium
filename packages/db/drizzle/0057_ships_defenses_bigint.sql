-- Migrate planet_ships and planet_defenses counters from integer (int32, max ~2.14B)
-- to bigint (int64). Late-game accumulation (notably solar satellites and light
-- units) overflowed int32 during fleet-return updates, causing error 22003
-- "value ... is out of range for type integer" and jamming the fleet worker.
ALTER TABLE "planet_ships"
  ALTER COLUMN "small_cargo"      TYPE bigint,
  ALTER COLUMN "large_cargo"      TYPE bigint,
  ALTER COLUMN "interceptor"      TYPE bigint,
  ALTER COLUMN "frigate"          TYPE bigint,
  ALTER COLUMN "cruiser"          TYPE bigint,
  ALTER COLUMN "battlecruiser"    TYPE bigint,
  ALTER COLUMN "espionage_probe"  TYPE bigint,
  ALTER COLUMN "colony_ship"      TYPE bigint,
  ALTER COLUMN "recycler"         TYPE bigint,
  ALTER COLUMN "prospector"       TYPE bigint,
  ALTER COLUMN "recuperateur"     TYPE bigint,
  ALTER COLUMN "solar_satellite"  TYPE bigint,
  ALTER COLUMN "explorer"         TYPE bigint;

ALTER TABLE "planet_defenses"
  ALTER COLUMN "rocket_launcher"        TYPE bigint,
  ALTER COLUMN "light_laser"            TYPE bigint,
  ALTER COLUMN "heavy_laser"            TYPE bigint,
  ALTER COLUMN "electromagnetic_cannon" TYPE bigint,
  ALTER COLUMN "plasma_turret"          TYPE bigint;
