# Flagship Dynamic Stats Design

## Summary

Replace the flagship's fixed base stats with dynamic values derived from the player's unlocked ships. Each base stat equals the highest value for that stat among all ships the player has ever built (at least once). Talent bonuses continue to apply on top.

## Decisions

- **Unlocking criterion**: a ship counts as unlocked once the player has built it at least once, even if all copies are later destroyed (option B)
- **Excluded ships**: `espionageProbe`, `solarSatellite`, `explorer` — their stats are too extreme or irrelevant for the flagship
- **Stats scope**: `weapons`, `shield`, `hull`, `baseArmor`, `shotCount`, `baseSpeed`, `cargoCapacity` use **max**; `fuelConsumption` uses **min** (advantage to the player)
- **Talents**: still additive on top of the dynamic base (unchanged behavior)
- **driveType**: unchanged, still governed by talent unlocks (impulse/hyperespace)
- **Default stats**: a new player with no unlocked ships keeps the current hardcoded defaults

## Data Model

### New column on `flagships`

```sql
unlocked_ships TEXT[] NOT NULL DEFAULT '{}'
```

Stores IDs of ship types built at least once (e.g. `{interceptor,frigate,cruiser}`).

## Computation Logic

### Function: `computeBaseStatsFromShips`

Location: `packages/game-engine/src/flagship/`

Input: array of ship definitions (filtered to unlocked + non-excluded).

Output: `{ weapons, shield, hull, baseArmor, shotCount, baseSpeed, fuelConsumption, cargoCapacity }`

For each stat, take the **max** across all input ships, except `fuelConsumption` which uses **min**.

If the input array is empty, return the current hardcoded defaults (weapons=12, shield=16, hull=30, baseArmor=2, shotCount=2, baseSpeed=10000, fuelConsumption=75, cargoCapacity=5000).

### Excluded ships constant

```typescript
const FLAGSHIP_EXCLUDED_SHIPS = ['espionageProbe', 'solarSatellite', 'explorer'];
```

## Integration Points

### 1. Shipyard build completion (`shipyard.service.ts` — `completeUnit`)

After incrementing the ship count:
1. Check if the built ship type is in `FLAGSHIP_EXCLUDED_SHIPS` — if yes, skip
2. Load the player's flagship `unlocked_ships`
3. If the type is already in the array, skip
4. Add the type to `unlocked_ships`
5. Load all `ship_definitions` for the updated `unlocked_ships` list
6. Call `computeBaseStatsFromShips` to get new base stats
7. UPDATE the flagship row with `unlocked_ships` + all base stat columns

### 2. Flagship read path (`flagship.service.ts` — `get`)

No change needed. The existing `effectiveStats` computation reads base stats from the flagship row and adds talent bonuses. Since base stats are now dynamic but still stored in the same columns, the read path works as-is.

### 3. Flagship creation

When a new flagship is created, `unlocked_ships` starts empty and base stats use the hardcoded defaults (same as current behavior).

## Migration

### Schema migration (0025)

1. `ALTER TABLE flagships ADD COLUMN unlocked_ships TEXT[] NOT NULL DEFAULT '{}'`

### Retroactive data migration

For existing players, populate `unlocked_ships` by scanning `planet_ships` across all their planets:
- For each ship type column in `planet_ships`, if any planet has count > 0, add that type to `unlocked_ships`
- Then recompute and update base stats

This can be done as a one-time script or as part of the migration SQL using a CTE/UPDATE.

## Files Impacted

| File | Change |
|------|--------|
| `packages/db/src/schema/flagships.ts` | Add `unlockedShips` column |
| `packages/db/drizzle/0025_flagship_dynamic_stats.sql` | Migration: add column + retroactive population |
| `packages/game-engine/src/flagship/compute-base-stats.ts` | New: `computeBaseStatsFromShips()` + `FLAGSHIP_EXCLUDED_SHIPS` |
| `apps/api/src/modules/shipyard/shipyard.service.ts` | Hook in `completeUnit` to trigger recalc |
| `apps/api/src/modules/flagship/flagship.service.ts` | New method `recalculateBaseStats(userId)` |
