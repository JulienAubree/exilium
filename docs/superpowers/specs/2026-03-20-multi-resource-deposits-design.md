# Multi-Resource Mining Deposits — Design Spec

## Goal

Replace single-resource asteroid deposits with multi-resource deposits. Each deposit contains 2 or 3 resources with proportions varying by belt position. Cargo loading distributes extracted resources proportionally to what remains in the deposit.

## Current State

- Each `asteroid_deposits` row has one `resource_type` (minerai | silicium | hydrogene) and `total_quantity` / `remaining_quantity`.
- `computeMiningExtraction` returns a single number: how much of that one resource the player receives.
- Slag rates are per-resource per-position (6 keys in `universe_config`).
- `pve_missions.parameters` stores `{ depositId, resourceType, remainingQuantity }`.
- `pve_missions.rewards` stores `{ resourceType, estimatedQuantity }`.
- `fleet_events` has `mineraiCargo`, `siliciumCargo`, `hydrogeneCargo` columns (already supports multi-resource cargo).

## Design

### 1. Database Schema Changes

**`asteroid_deposits`** — replace single-resource columns with per-resource columns:

Remove:
- `resource_type`
- `total_quantity`
- `remaining_quantity`
- Index `deposits_belt_remaining_idx` on `(beltId, remainingQuantity)` — references removed column

Add:
- `minerai_total` numeric(20,2) NOT NULL DEFAULT 0
- `minerai_remaining` numeric(20,2) NOT NULL DEFAULT 0
- `silicium_total` numeric(20,2) NOT NULL DEFAULT 0
- `silicium_remaining` numeric(20,2) NOT NULL DEFAULT 0
- `hydrogene_total` numeric(20,2) NOT NULL DEFAULT 0
- `hydrogene_remaining` numeric(20,2) NOT NULL DEFAULT 0

New index: `deposits_belt_remaining_idx` on `(beltId)` — the old index filtered on `remainingQuantity`; the new index covers belt lookups, and availability is checked via `WHERE minerai_remaining + silicium_remaining + hydrogene_remaining > 0`.

A resource with `*_remaining = 0` and `*_total = 0` was never present in the deposit. A resource with `*_total > 0` and `*_remaining = 0` has been depleted.

`regenerates_at` stays — triggered when ALL three `*_remaining` are 0.

**`universe_config`** — simplify slag rates:

Remove 6 keys: `slag_rate.pos8.minerai`, `slag_rate.pos8.silicium`, `slag_rate.pos8.hydrogene`, `slag_rate.pos16.minerai`, `slag_rate.pos16.silicium`, `slag_rate.pos16.hydrogene`.

Add 2 keys:
- `slag_rate.pos8` = 0.30
- `slag_rate.pos16` = 0.15

### 2. Deposit Generation

When creating deposits in `asteroid-belt.service.ts`:

**Step 1 — Determine which resources are present.**

Roll each resource independently. At least 2 must be present (reroll if only 1).

| Resource   | Position 8 | Position 16 |
|------------|-----------|------------|
| Minerai    | 95%       | 60%        |
| Silicium   | 90%       | 65%        |
| Hydrogene  | 25%       | 90%        |

**Step 2 — Distribute total quantity among present resources.**

Total quantity is computed as today (20k-40k for pos 8, 40k-80k for pos 16, scaled by centerLevel).

Distribution weights (normalized to present resources only):

| Resource   | Position 8 | Position 16 |
|------------|-----------|------------|
| Minerai    | 45%       | 25%        |
| Silicium   | 45%       | 25%        |
| Hydrogene  | 10%       | 50%        |

Example: pos 8, total 30,000, only minerai + silicium present.
- Normalize: 45/(45+45) = 50% each.
- minerai: 15,000, silicium: 15,000.

Example: pos 16, total 60,000, all 3 present.
- minerai: 15,000, silicium: 15,000, hydrogene: 30,000.

### 3. Extraction Formula

`computeMiningExtraction` changes signature. Currently returns `{ playerReceives: number, depositLoss: number }` for a single resource. New return type:

```ts
interface MultiResourceExtraction {
  playerReceives: { minerai: number; silicium: number; hydrogene: number };
  depositLoss: { minerai: number; silicium: number; hydrogene: number };
}
```

**Algorithm:**

1. Compute `rawExtraction` and `effectiveCargo` as today (unchanged).
2. If `slagRate === 0`: `effectiveCargo = cargoCapacity` (no slag reduction). Otherwise `effectiveCargo = cargoCapacity * (1 - slagRate)`.
3. `maxExtractable = min(rawExtraction, effectiveCargo)`.
4. `totalRemaining = minerai_remaining + silicium_remaining + hydrogene_remaining`.
5. If `totalRemaining <= 0`: return all zeros.
6. Distribute proportionally to remaining quantities:
   ```
   ratio_m = minerai_remaining / totalRemaining
   ratio_s = silicium_remaining / totalRemaining
   ratio_h = hydrogene_remaining / totalRemaining
   ```
7. **Normal case** (`maxExtractable < totalRemaining`):
   ```
   player_m = floor(maxExtractable * ratio_m)
   player_s = floor(maxExtractable * ratio_s)
   player_h = maxExtractable - player_m - player_s  // remainder goes to last
   depositLoss_m = floor(player_m / (1 - slagRate))  // clamped to minerai_remaining
   depositLoss_s = floor(player_s / (1 - slagRate))  // clamped to silicium_remaining
   depositLoss_h = floor(player_h / (1 - slagRate))  // clamped to hydrogene_remaining
   ```
8. **Deposit nearly depleted** (`maxExtractable >= totalRemaining`): the fleet could extract more than what's left. The deposit is fully drained:
   ```
   depositLoss_m = minerai_remaining
   depositLoss_s = silicium_remaining
   depositLoss_h = hydrogene_remaining
   player_m = floor(minerai_remaining * (1 - slagRate))
   player_s = floor(silicium_remaining * (1 - slagRate))
   player_h = floor(hydrogene_remaining * (1 - slagRate))
   ```
   The player receives less than the deposit total because slag is lost.
9. If `slagRate === 0`: `depositLoss_x = player_x` for each resource (no slag, player receives exactly what the deposit loses).

**Slag rate** is a single value per position (not per resource). `computeSlagRate(baseSlagRate, refiningLevel)` is unchanged.

### 4. Atomic Extraction (DB)

`extractFromDeposit` changes from updating one `remaining_quantity` column to updating three:

```sql
UPDATE asteroid_deposits
SET minerai_remaining = GREATEST(0, minerai_remaining - $minerai_loss),
    silicium_remaining = GREATEST(0, silicium_remaining - $silicium_loss),
    hydrogene_remaining = GREATEST(0, hydrogene_remaining - $hydrogene_loss),
    regenerates_at = CASE
      WHEN GREATEST(0, minerai_remaining - $minerai_loss)
         + GREATEST(0, silicium_remaining - $silicium_loss)
         + GREATEST(0, hydrogene_remaining - $hydrogene_loss) <= 0
      THEN NOW() + $regen_delay
      ELSE NULL
    END
WHERE id = $depositId
  AND (minerai_remaining + silicium_remaining + hydrogene_remaining) > 0
RETURNING minerai_remaining, silicium_remaining, hydrogene_remaining
```

After the UPDATE, recompute actual `playerReceives` per resource from what was actually deducted (handles concurrent extraction).

### 5. Mine Handler Changes

**`processMineDone`:**
- Fetch deposit with all 3 remaining columns.
- Look up single `slag_rate.pos{N}` instead of `slag_rate.pos{N}.{resourceType}`.
- Call updated `computeMiningExtraction` with `{ mineraiRemaining, siliciumRemaining, hydrogeneRemaining }`.
- Call updated `extractFromDeposit` with per-resource loss amounts.
- Write all 3 cargo columns to `fleet_events`.

**`processArrival` (prospection duration):**
- `totalQuantity` becomes sum of `minerai_total + silicium_total + hydrogene_total` (use `*_total` not `*_remaining` so duration is stable regardless of prior extractions by other players).

### 6. PvE Mission Data Changes

**`pve_missions.parameters`:**
- Remove: `resourceType`, `remainingQuantity`.
- Add: `resources: { minerai?: number; silicium?: number; hydrogene?: number }` (snapshot of remaining at generation time).

**`pve_missions.rewards`:**
- Change from `{ resourceType, estimatedQuantity }` to `{ minerai?: number; silicium?: number; hydrogene?: number }`.

These are JSONB columns — no schema migration needed, just code changes.

### 7. Regeneration

When all 3 `*_remaining` hit 0, `regenerates_at` is set. On regeneration, the deposit is re-generated with fresh rolls (presence + proportions) at centerLevel=1 (same as today).

**`regenerateDepletedDeposits`** — update the query filter: currently checks `remainingQuantity <= 0`. Must change to `minerai_remaining + silicium_remaining + hydrogene_remaining <= 0`.

**`generateMiningMission`** (in `pve.service.ts`) — update the available-deposit filter: currently checks `Number(d.remainingQuantity) > 0`. Must change to `Number(d.mineraiRemaining) + Number(d.siliciumRemaining) + Number(d.hydrogeneRemaining) > 0`.

### 8. System Message

Current message shows one resource extracted. Updated message shows breakdown:

```
Extraction terminee (duree totale: Xm).
Minerai: +1,234 | Silicium: +567 | Hydrogene: +890
Pertes (scories): 15%
```

Only show resources with non-zero amounts.

### 9. Frontend Impact

**Mission cards** (`apps/web/src/pages/Missions.tsx` or equivalent):
- Currently show one `resourceType` + icon + estimated quantity. Now show up to 3 resource icons with their estimated quantities. Only display resources with non-zero amounts.

**Fleet summary / cargo display:**
- Already supports 3 cargo types — no change needed.

### 10. Seed Data Changes

- Remove 6 `slag_rate.pos{N}.{resourceType}` entries from `seed-game-config.ts`.
- Add 2 `slag_rate.pos8` and `slag_rate.pos16` entries.
- Update any existing deposits in dev DB via migration (or let regeneration handle it).

### 11. Files Impacted

| File | Change |
|------|--------|
| `packages/db/src/schema/asteroid-belts.ts` | Replace columns |
| `packages/db/drizzle/0008_*.sql` | Migration |
| `packages/game-engine/src/formulas/pve.ts` | Update `computeMiningExtraction` signature and logic |
| `packages/game-engine/src/formulas/pve.test.ts` | Update tests for multi-resource extraction |
| `apps/api/src/modules/pve/asteroid-belt.service.ts` | Multi-resource generation, extraction, regeneration |
| `apps/api/src/modules/fleet/handlers/mine.handler.ts` | Multi-resource extraction flow, single slag rate |
| `apps/api/src/modules/pve/pve.service.ts` | Update mission generation (parameters/rewards format) |
| `apps/api/src/modules/pve/pve.router.ts` | Update response shape if needed |
| `packages/db/src/seed-game-config.ts` | Slag rate simplification |
| `apps/web/src/pages/Missions.tsx` (or equivalent) | Multi-resource display on mission cards |
