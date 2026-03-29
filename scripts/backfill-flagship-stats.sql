-- Backfill all flagships: re-scan planet_ships to rebuild unlocked_ships,
-- then recalculate base stats (MAX per stat, MIN for fuel_consumption).
-- Safe to run multiple times (idempotent).

BEGIN;

-- Step 1: Rebuild unlocked_ships from actual planet_ships data
WITH user_unlocks AS (
  SELECT
    f."id" AS flagship_id,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN SUM(ps."prospector") > 0 THEN 'prospector' END,
      CASE WHEN SUM(ps."small_cargo") > 0 THEN 'smallCargo' END,
      CASE WHEN SUM(ps."large_cargo") > 0 THEN 'largeCargo' END,
      CASE WHEN SUM(ps."colony_ship") > 0 THEN 'colonyShip' END,
      CASE WHEN SUM(ps."recycler") > 0 THEN 'recycler' END,
      CASE WHEN SUM(ps."interceptor") > 0 THEN 'interceptor' END,
      CASE WHEN SUM(ps."frigate") > 0 THEN 'frigate' END,
      CASE WHEN SUM(ps."cruiser") > 0 THEN 'cruiser' END,
      CASE WHEN SUM(ps."battlecruiser") > 0 THEN 'battlecruiser' END
    ], NULL) AS ships
  FROM "flagships" f
  JOIN "planets" p ON p."user_id" = f."user_id"
  JOIN "planet_ships" ps ON ps."planet_id" = p."id"
  GROUP BY f."id"
)
UPDATE "flagships" f
SET "unlocked_ships" = u.ships
FROM user_unlocks u
WHERE f."id" = u.flagship_id
  AND ARRAY_LENGTH(u.ships, 1) > 0;

-- Step 2: Recalculate base stats from unlocked_ships
WITH ship_stats(ship_id, w, s, h, a, sc, spd, fuel, cargo) AS (
  VALUES
    ('prospector',    1,  8, 15, 0, 1,  3000,   50,   750),
    ('smallCargo',    1,  8, 12, 0, 1,  5000,   10,  5000),
    ('largeCargo',    1, 20, 36, 0, 1,  7500,   50, 25000),
    ('colonyShip',    4, 80, 90, 0, 1,  2500, 1000,  7500),
    ('recycler',      1,  8, 48, 0, 1,  2000,  300, 20000),
    ('interceptor',   4,  8, 12, 1, 3, 12500,   20,    50),
    ('frigate',      12, 16, 30, 2, 2, 10000,   75,   100),
    ('cruiser',      45, 28, 55, 4, 1, 15000,  300,   800),
    ('battlecruiser', 70, 40,100, 6, 1, 10000,  500,  1500)
),
flagship_new_stats AS (
  SELECT
    f."id",
    MAX(ss.w)   AS weapons,
    MAX(ss.s)   AS shield,
    MAX(ss.h)   AS hull,
    MAX(ss.a)   AS base_armor,
    MAX(ss.sc)  AS shot_count,
    MAX(ss.spd) AS base_speed,
    MIN(ss.fuel) AS fuel_consumption,
    MAX(ss.cargo) AS cargo_capacity
  FROM "flagships" f
  JOIN LATERAL UNNEST(f."unlocked_ships") AS uid(ship_id) ON TRUE
  JOIN ship_stats ss ON ss.ship_id = uid.ship_id
  WHERE ARRAY_LENGTH(f."unlocked_ships", 1) > 0
  GROUP BY f."id"
)
UPDATE "flagships" f
SET
  "weapons"          = ns.weapons,
  "shield"           = ns.shield,
  "hull"             = ns.hull,
  "base_armor"       = ns.base_armor,
  "shot_count"       = ns.shot_count,
  "base_speed"       = ns.base_speed,
  "fuel_consumption" = ns.fuel_consumption,
  "cargo_capacity"   = ns.cargo_capacity
FROM flagship_new_stats ns
WHERE f."id" = ns."id";

COMMIT;
