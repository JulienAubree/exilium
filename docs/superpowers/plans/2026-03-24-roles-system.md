# SP4 — Système de rôles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded entity IDs in business logic with role-based lookups from DB config, so that renaming/replacing entities doesn't break game logic.

**Architecture:** Add a `role` column (text, nullable, unique when non-null) to `building_definitions`, `ship_definitions`, and `planet_types` tables. Create lookup helpers (`findShipByRole`, `findBuildingByRole`, `findPlanetTypeByRole`) that resolve a semantic role to the current entity definition. Migrate all backend handlers and services that reference entity IDs by string literal to use role-based lookup instead. Expose `role` in GameConfig interfaces and admin UI.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), tRPC + Zod, React (admin panel)

**Spec reference:** `docs/superpowers/specs/2026-03-23-eliminate-hardcoded-data-design.md` lines 249-317

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/db/src/schema/game-config.ts` | Modify | Add `role` column to `buildingDefinitions`, `shipDefinitions`, `planetTypes` |
| `packages/db/src/seed-game-config.ts` | Modify | Seed role values for existing entities |
| `apps/api/src/modules/admin/game-config.service.ts` | Modify | Expose `role` in config interfaces + CRUD |
| `apps/api/src/modules/admin/game-config.router.ts` | Modify | Add `role` to Zod schemas for create/update |
| `apps/api/src/lib/config-helpers.ts` | Create | `findShipByRole`, `findBuildingByRole`, `findPlanetTypeByRole` helpers |
| `apps/api/src/lib/config-helpers.test.ts` | Create | Unit tests for role lookup helpers |
| `apps/api/src/modules/fleet/handlers/recycle.handler.ts` | Modify | Use role lookup instead of `'recycler'` |
| `apps/api/src/modules/fleet/handlers/spy.handler.ts` | Modify | Use role lookup instead of `'espionageProbe'` |
| `apps/api/src/modules/fleet/handlers/mine.handler.ts` | Modify | Use role lookup instead of `'prospector'` |
| `apps/api/src/modules/fleet/handlers/colonize.handler.ts` | Modify | Use role lookup instead of `'colonyShip'`, `'homeworld'` |
| `apps/api/src/modules/resource/resource.service.ts` | Modify | Use role lookup for 7 building IDs |
| `apps/api/src/cron/resource-tick.ts` | Modify | Use role lookup for 7 building IDs + `'homeworld'` |
| `apps/api/src/modules/planet/planet.service.ts` | Modify | Use role lookup instead of `'homeworld'` string |
| `apps/api/src/modules/pve/pve.service.ts` | Modify | Use role lookup instead of `'missionCenter'` in raw SQL |
| `apps/admin/src/pages/Ships.tsx` | Modify | Show/edit `role` column |
| `apps/admin/src/pages/Buildings.tsx` | Modify | Show/edit `role` column |
| `apps/admin/src/pages/PlanetTypes.tsx` | Modify | Show/edit `role` column |

---

### Task 1: Add `role` column to DB schema + migration

**Files:**
- Modify: `packages/db/src/schema/game-config.ts` (lines 14-26, 76-96, 155-167)
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Add `role` column to `buildingDefinitions` table**

In `packages/db/src/schema/game-config.ts`, add after `sortOrder` (line 24):

```typescript
  role: varchar('role', { length: 64 }).unique(),
```

The `.unique()` enforces that no two buildings can share the same role (nullable values are excluded from the unique constraint by PostgreSQL).

- [ ] **Step 2: Add `role` column to `shipDefinitions` table**

Same file, add after `sortOrder` (line 94):

```typescript
  role: varchar('role', { length: 64 }).unique(),
```

- [ ] **Step 3: Add `role` column to `planetTypes` table**

Same file, add after `sortOrder` (line 167):

```typescript
  role: varchar('role', { length: 64 }).unique(),
```

- [ ] **Step 4: Add role values to building seeds**

In `packages/db/src/seed-game-config.ts`, add `role` to each building in the `buildings` array:

```typescript
// Add role field to these buildings:
{ id: 'mineraiMine',      ..., role: 'producer_minerai' },
{ id: 'siliciumMine',     ..., role: 'producer_silicium' },
{ id: 'hydrogeneSynth',   ..., role: 'producer_hydrogene' },
{ id: 'solarPlant',       ..., role: 'producer_energy' },
{ id: 'storageMinerai',   ..., role: 'storage_minerai' },
{ id: 'storageSilicium',  ..., role: 'storage_silicium' },
{ id: 'storageHydrogene', ..., role: 'storage_hydrogene' },
{ id: 'missionCenter',    ..., role: 'mission_center' },
// All other buildings: role: null (or omit, defaults to null)
```

- [ ] **Step 5: Add role values to ship seeds**

Same file, add `role` to each ship:

```typescript
{ id: 'prospector',     ..., role: 'prospector' },
{ id: 'recycler',       ..., role: 'recycler' },
{ id: 'colonyShip',     ..., role: 'colonizer' },
{ id: 'espionageProbe', ..., role: 'probe' },
{ id: 'solarSatellite', ..., role: 'stationary' },
// All other ships: role: null
```

- [ ] **Step 6: Add role value to planet type seeds**

Same file, add `role` to homeworld planet type:

```typescript
{ id: 'homeworld', ..., role: 'homeworld' },
// All other planet types: role: null
```

- [ ] **Step 7: Generate and run migration**

```bash
cd /Users/julienaubree/_projet/exilium/packages/db && npm run db:generate
```

Review the generated SQL migration to confirm it adds 3 nullable `role` columns. Then:

```bash
npm run db:push
```

- [ ] **Step 8: Run seed to populate role values**

```bash
cd /Users/julienaubree/_projet/exilium/packages/db && npm run db:seed
```

- [ ] **Step 9: Commit**

```bash
git add packages/db/src/schema/game-config.ts packages/db/src/seed-game-config.ts packages/db/drizzle/
git commit -m "feat(db): add role column to building_definitions, ship_definitions, planet_types"
```

---

### Task 2: Expose `role` in GameConfig interfaces and service

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.service.ts` (lines 74-85, 105-127, 148-160, 256-271, 297-323, 375-387)

- [ ] **Step 1: Add `role` to `BuildingConfig` interface**

In `game-config.service.ts`, add to `BuildingConfig` (after line 83):

```typescript
  role: string | null;
```

- [ ] **Step 2: Add `role` to `ShipConfig` interface**

Add to `ShipConfig` (after line 122):

```typescript
  role: string | null;
```

- [ ] **Step 3: Add `role` to `PlanetTypeConfig` interface**

Add to `PlanetTypeConfig` (after line 159):

```typescript
  role: string | null;
```

- [ ] **Step 4: Map `role` in buildings construction**

In `getFullConfig()`, building mapping (around line 264), add:

```typescript
  role: b.role ?? null,
```

- [ ] **Step 5: Map `role` in ships construction**

In `getFullConfig()`, ships mapping (around line 313), add:

```typescript
  role: s.role ?? null,
```

- [ ] **Step 6: Map `role` in planet types construction**

In `getFullConfig()`, planet types mapping (around line 383), add:

```typescript
  role: pt.role ?? null,
```

- [ ] **Step 7: Add `role` to `createBuilding`, `updateBuilding` signatures**

In `createBuilding` (around line 474), add `role?: string | null` to the `data` parameter type and pass through:

```typescript
role: data.role ?? null,
```

In `updateBuilding` (around line 548), add `role: string | null` to the Partial type.

- [ ] **Step 8: Add `role` to `createShip`, `updateShip` signatures**

Same pattern: add `role?: string | null` to `createShip` data param, and `role: string | null` to `updateShip` Partial type.

- [ ] **Step 9: Add `role` to `createPlanetType`, `updatePlanetType` signatures**

Same pattern for planet types.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/admin/game-config.service.ts
git commit -m "feat(api): expose role in GameConfig interfaces and CRUD"
```

---

### Task 3: Add `role` to admin tRPC router Zod schemas

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.router.ts`

- [ ] **Step 1: Add `role` to `createBuilding` Zod schema**

At line 54 (before the closing `})`), add:

```typescript
role: z.string().nullable().optional(),
```

- [ ] **Step 2: Add `role` to `updateBuilding` Zod schema**

Inside the `data` object at line 81, add:

```typescript
role: z.string().nullable().optional(),
```

- [ ] **Step 3: Add `role` to `createShip` Zod schema**

At line 179 (inside the input object), add:

```typescript
role: z.string().nullable().optional(),
```

- [ ] **Step 4: Add `role` to `updateShip` Zod schema**

Inside the `data` object at line 213, add:

```typescript
role: z.string().nullable().optional(),
```

- [ ] **Step 5: Add `role` to `createPlanetType` Zod schema**

At line 351 (inside the input object), add:

```typescript
role: z.string().nullable().optional(),
```

- [ ] **Step 6: Add `role` to `updatePlanetType` Zod schema**

Inside the `data` object at line 370, add:

```typescript
role: z.string().nullable().optional(),
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/admin/game-config.router.ts
git commit -m "feat(api): add role to admin Zod schemas for buildings, ships, planet types"
```

---

### Task 4: Create role lookup helpers with tests

**Files:**
- Create: `apps/api/src/lib/config-helpers.ts`
- Create: `apps/api/src/lib/config-helpers.test.ts`

- [ ] **Step 1: Write tests for `findShipByRole`**

Create `apps/api/src/lib/config-helpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findShipByRole, findBuildingByRole, findPlanetTypeByRole } from './config-helpers.js';
import type { GameConfig } from '../modules/admin/game-config.service.js';

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    categories: [],
    buildings: {},
    research: {},
    ships: {},
    defenses: {},
    rapidFire: {},
    production: {},
    universe: {},
    planetTypes: [],
    pirateTemplates: [],
    tutorialQuests: [],
    bonuses: [],
    missions: {},
    labels: {},
    ...overrides,
  };
}

describe('findShipByRole', () => {
  it('returns the ship definition matching the role', () => {
    const config = makeConfig({
      ships: {
        recycler: { id: 'recycler', name: 'Recycleur', role: 'recycler' } as any,
        smallCargo: { id: 'smallCargo', name: 'Petit transporteur', role: null } as any,
      },
    });
    const result = findShipByRole(config, 'recycler');
    expect(result.id).toBe('recycler');
  });

  it('throws if no ship has the requested role', () => {
    const config = makeConfig({ ships: {} });
    expect(() => findShipByRole(config, 'recycler')).toThrow('No ship with role "recycler"');
  });
});

describe('findBuildingByRole', () => {
  it('returns the building matching the role', () => {
    const config = makeConfig({
      buildings: {
        mineraiMine: { id: 'mineraiMine', name: 'Mine de minerai', role: 'producer_minerai' } as any,
      },
    });
    const result = findBuildingByRole(config, 'producer_minerai');
    expect(result.id).toBe('mineraiMine');
  });

  it('throws if no building has the requested role', () => {
    const config = makeConfig({ buildings: {} });
    expect(() => findBuildingByRole(config, 'producer_minerai')).toThrow('No building with role "producer_minerai"');
  });
});

describe('findPlanetTypeByRole', () => {
  it('returns the planet type matching the role', () => {
    const config = makeConfig({
      planetTypes: [
        { id: 'homeworld', name: 'Planète mère', role: 'homeworld' } as any,
        { id: 'desert', name: 'Désert', role: null } as any,
      ],
    });
    const result = findPlanetTypeByRole(config, 'homeworld');
    expect(result.id).toBe('homeworld');
  });

  it('throws if no planet type has the requested role', () => {
    const config = makeConfig({ planetTypes: [] });
    expect(() => findPlanetTypeByRole(config, 'homeworld')).toThrow('No planet type with role "homeworld"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/julienaubree/_projet/exilium && npx vitest run apps/api/src/lib/config-helpers.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement the helpers**

Create `apps/api/src/lib/config-helpers.ts`:

```typescript
import type { GameConfig, ShipConfig, BuildingConfig, PlanetTypeConfig } from '../modules/admin/game-config.service.js';

export function findShipByRole(config: GameConfig, role: string): ShipConfig {
  const ship = Object.values(config.ships).find((s) => s.role === role);
  if (!ship) throw new Error(`No ship with role "${role}" found in config`);
  return ship;
}

export function findBuildingByRole(config: GameConfig, role: string): BuildingConfig {
  const building = Object.values(config.buildings).find((b) => b.role === role);
  if (!building) throw new Error(`No building with role "${role}" found in config`);
  return building;
}

export function findPlanetTypeByRole(config: GameConfig, role: string): PlanetTypeConfig {
  const pt = config.planetTypes.find((p) => p.role === role);
  if (!pt) throw new Error(`No planet type with role "${role}" found in config`);
  return pt;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/julienaubree/_projet/exilium && npx vitest run apps/api/src/lib/config-helpers.test.ts
```

Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/config-helpers.ts apps/api/src/lib/config-helpers.test.ts
git commit -m "feat(api): add findShipByRole, findBuildingByRole, findPlanetTypeByRole helpers"
```

---

### Task 5: Migrate fleet handlers to role-based lookups

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/recycle.handler.ts` (lines 10, 41-42)
- Modify: `apps/api/src/modules/fleet/handlers/spy.handler.ts` (lines 12, 20)
- Modify: `apps/api/src/modules/fleet/handlers/mine.handler.ts` (line 10)
- Modify: `apps/api/src/modules/fleet/handlers/colonize.handler.ts` (lines 12, 97, 114, 139-140)

- [ ] **Step 1: Migrate `recycle.handler.ts`**

Add import at top:

```typescript
import { findShipByRole } from '../../../lib/config-helpers.js';
```

Replace `validateFleet` (lines 8-13):

```typescript
  async validateFleet(input: SendFleetInput, _config: GameConfig, ctx: MissionHandlerContext): Promise<void> {
    const config = await ctx.gameConfigService.getFullConfig();
    const recyclerDef = findShipByRole(config, 'recycler');
    for (const [shipType, count] of Object.entries(input.ships)) {
      if (count > 0 && shipType !== recyclerDef.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seuls les recycleurs peuvent être envoyés en mission recyclage' });
      }
    }
  }
```

Replace `processArrival` lines 40-42 (recycler cargo lookup):

```typescript
    const config = await ctx.gameConfigService.getFullConfig();
    const recyclerDef = findShipByRole(config, 'recycler');
    const recyclerCount = fleetEvent.ships[recyclerDef.id] ?? 0;
    const cargoPerRecycler = recyclerDef.cargoCapacity ?? 20000;
```

- [ ] **Step 2: Migrate `spy.handler.ts`**

Add import at top:

```typescript
import { findShipByRole } from '../../../lib/config-helpers.js';
```

Replace `validateFleet` (lines 10-15):

```typescript
  async validateFleet(input: SendFleetInput, _config: GameConfig, ctx: MissionHandlerContext): Promise<void> {
    const config = await ctx.gameConfigService.getFullConfig();
    const probeDef = findShipByRole(config, 'probe');
    for (const [shipType, count] of Object.entries(input.ships)) {
      if (count > 0 && shipType !== probeDef.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seules les sondes d\'espionnage peuvent être envoyées en mission espionnage' });
      }
    }
  }
```

Replace line 20 (`ships.espionageProbe`):

```typescript
    const config = await ctx.gameConfigService.getFullConfig();
    const probeDef = findShipByRole(config, 'probe');
    const probeCount = ships[probeDef.id] ?? 0;
```

- [ ] **Step 3: Migrate `mine.handler.ts`**

Add import at top:

```typescript
import { findShipByRole } from '../../../lib/config-helpers.js';
```

Replace line 10 in `validateFleet`:

```typescript
  async validateFleet(input: SendFleetInput, config: GameConfig, ctx: MissionHandlerContext): Promise<void> {
    const fullConfig = await ctx.gameConfigService.getFullConfig();
    const prospectorDef = findShipByRole(fullConfig, 'prospector');
    const prospectorCount = input.ships[prospectorDef.id] ?? 0;
    if (prospectorCount === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'La mission Miner nécessite au moins 1 prospecteur' });
    }
```

Note: The rest of `validateFleet` (belt_positions check) stays unchanged. The `config` parameter is kept for the `belt_positions` check which uses it.

- [ ] **Step 4: Migrate `colonize.handler.ts`**

Add import at top:

```typescript
import { findShipByRole, findPlanetTypeByRole } from '../../../lib/config-helpers.js';
```

Replace `validateFleet` (lines 10-15):

```typescript
  async validateFleet(input: SendFleetInput, _config: GameConfig, ctx: MissionHandlerContext): Promise<void> {
    const config = await ctx.gameConfigService.getFullConfig();
    const colonyShipDef = findShipByRole(config, 'colonizer');
    for (const [shipType, count] of Object.entries(input.ships)) {
      if (count > 0 && shipType !== colonyShipDef.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seuls les vaisseaux de colonisation peuvent être envoyés en mission colonisation' });
      }
    }
  }
```

Replace line 97 (`pt.id !== 'homeworld'`):

```typescript
    const homeworldType = findPlanetTypeByRole(config, 'homeworld');
    const planetTypeForPos = config.planetTypes.find(
      (pt) => pt.id !== homeworldType.id && (pt.positions as number[]).includes(fleetEvent.targetPosition),
    );
```

Replace line 114 (fallback image index):

```typescript
    const planetImageIndex = getRandomPlanetImageIndex(planetTypeForPos?.id ?? homeworldType.id, ctx.assetsDir);
```

Replace lines 139-140 (`remainingShips.colonyShip`):

```typescript
    const remainingShips = { ...ships };
    const colonyShipDef = findShipByRole(config, 'colonizer');
    if (remainingShips[colonyShipDef.id]) {
      remainingShips[colonyShipDef.id] = Math.max(0, remainingShips[colonyShipDef.id] - 1);
    }
```

Note: `colonyShipDef` is already in scope from `validateFleet` — but `processArrival` is a separate method so we need to redeclare it. Actually, `config` is already fetched at line 26, so just add `const colonyShipDef = findShipByRole(config, 'colonizer');` after the existing `config` fetch.

- [ ] **Step 5: Verify TypeScript compilation**

```bash
cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p apps/api/tsconfig.json
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/
git commit -m "feat(api): migrate fleet handlers to role-based entity lookups"
```

---

### Task 6: Migrate resource.service.ts to role-based lookups

**Files:**
- Modify: `apps/api/src/modules/resource/resource.service.ts` (lines 43-68)

The `buildPlanetLevels` function (lines 43-69) maps 7 hardcoded building IDs to named level fields. The `calculateResources` function from `game-engine` expects these specific field names (`mineraiMineLevel`, `solarPlantLevel`, etc.), so we cannot change the field names — but we must resolve which building ID corresponds to each role.

- [ ] **Step 1: Add imports**

At top of `resource.service.ts`, add:

```typescript
import { findBuildingByRole, findPlanetTypeByRole } from '../../lib/config-helpers.js';
import type { GameConfigService } from '../admin/game-config.service.js';
```

- [ ] **Step 2: Add `gameConfigService` parameter to `createResourceService`**

Change the function signature (line 71):

```typescript
export function createResourceService(db: Database, gameConfigService: GameConfigService) {
```

- [ ] **Step 3: Replace hardcoded IDs in `buildPlanetLevels`**

Replace the `buildPlanetLevels` function to accept a role map:

```typescript
async function buildPlanetLevels(
  db: Database,
  planetId: string,
  planet: {
    maxTemp: number;
    mineraiMinePercent: number;
    siliciumMinePercent: number;
    hydrogeneSynthPercent: number;
    planetClassId?: string | null;
  },
  roleMap: {
    producerMinerai: string;
    producerSilicium: string;
    producerHydrogene: string;
    producerEnergy: string;
    storageMinerai: string;
    storageSilicium: string;
    storageHydrogene: string;
    homeworldTypeId: string;
  },
) {
  const [buildingLevels, solarSatelliteCount] = await Promise.all([
    getBuildingLevels(db, planetId),
    getSolarSatelliteCount(db, planetId),
  ]);
  return {
    mineraiMineLevel: buildingLevels[roleMap.producerMinerai] ?? 0,
    siliciumMineLevel: buildingLevels[roleMap.producerSilicium] ?? 0,
    hydrogeneSynthLevel: buildingLevels[roleMap.producerHydrogene] ?? 0,
    solarPlantLevel: buildingLevels[roleMap.producerEnergy] ?? 0,
    storageMineraiLevel: buildingLevels[roleMap.storageMinerai] ?? 0,
    storageSiliciumLevel: buildingLevels[roleMap.storageSilicium] ?? 0,
    storageHydrogeneLevel: buildingLevels[roleMap.storageHydrogene] ?? 0,
    maxTemp: planet.maxTemp,
    solarSatelliteCount,
    isHomePlanet: planet.planetClassId === roleMap.homeworldTypeId,
    mineraiMinePercent: planet.mineraiMinePercent,
    siliciumMinePercent: planet.siliciumMinePercent,
    hydrogeneSynthPercent: planet.hydrogeneSynthPercent,
  };
}
```

- [ ] **Step 4: Build role map inside the service and pass to `buildPlanetLevels`**

Inside `createResourceService`, add a helper that resolves the role map once per call:

```typescript
  async function getRoleMap() {
    const config = await gameConfigService.getFullConfig();
    return {
      producerMinerai: findBuildingByRole(config, 'producer_minerai').id,
      producerSilicium: findBuildingByRole(config, 'producer_silicium').id,
      producerHydrogene: findBuildingByRole(config, 'producer_hydrogene').id,
      producerEnergy: findBuildingByRole(config, 'producer_energy').id,
      storageMinerai: findBuildingByRole(config, 'storage_minerai').id,
      storageSilicium: findBuildingByRole(config, 'storage_silicium').id,
      storageHydrogene: findBuildingByRole(config, 'storage_hydrogene').id,
      homeworldTypeId: findPlanetTypeByRole(config, 'homeworld').id,
    };
  }
```

Then update all 3 methods (`materializeResources`, `spendResources`, `getProductionRates`) to call `getRoleMap()` and pass it to `buildPlanetLevels`:

```typescript
    async materializeResources(planetId: string, userId: string) {
      // ... existing planet fetch ...
      const bonus = await loadPlanetTypeBonus(db, planet.planetClassId);
      const roleMap = await getRoleMap();
      const levels = await buildPlanetLevels(db, planetId, planet, roleMap);
      // ... rest unchanged ...
    },
```

Same for `spendResources` and `getProductionRates`.

- [ ] **Step 5: Update call sites that create `resourceService`**

In `apps/api/src/trpc/app-router.ts`, find where `createResourceService(db)` is called and add `gameConfigService`:

```typescript
const resourceService = createResourceService(db, gameConfigService);
```

In `apps/api/src/workers/worker.ts`, same change:

```typescript
const resourceService = createResourceService(db, gameConfigService);
```

- [ ] **Step 6: Verify TypeScript compilation**

```bash
cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p apps/api/tsconfig.json
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/resource/resource.service.ts apps/api/src/trpc/app-router.ts apps/api/src/workers/worker.ts
git commit -m "feat(api): migrate resource.service to role-based building lookups"
```

---

### Task 7: Migrate resource-tick.ts to role-based lookups

**Files:**
- Modify: `apps/api/src/cron/resource-tick.ts` (lines 40-49)

- [ ] **Step 1: Add `gameConfigService` parameter and imports**

```typescript
import { findBuildingByRole, findPlanetTypeByRole } from '../lib/config-helpers.js';
import type { GameConfigService } from '../modules/admin/game-config.service.js';

export async function resourceTick(db: Database, gameConfigService: GameConfigService) {
```

- [ ] **Step 2: Resolve role map at the start of the function**

After the existing pre-loading block (line 29), add:

```typescript
  // Resolve building IDs by role
  const config = await gameConfigService.getFullConfig();
  const mineraiMineId = findBuildingByRole(config, 'producer_minerai').id;
  const siliciumMineId = findBuildingByRole(config, 'producer_silicium').id;
  const hydrogeneSynthId = findBuildingByRole(config, 'producer_hydrogene').id;
  const solarPlantId = findBuildingByRole(config, 'producer_energy').id;
  const storageMineraiId = findBuildingByRole(config, 'storage_minerai').id;
  const storageSiliciumId = findBuildingByRole(config, 'storage_silicium').id;
  const storageHydrogeneId = findBuildingByRole(config, 'storage_hydrogene').id;
  const homeworldTypeId = findPlanetTypeByRole(config, 'homeworld').id;
```

- [ ] **Step 3: Replace hardcoded IDs in the loop**

Replace lines 40-49:

```typescript
    const resources = calculateResources(
      {
        minerai: Number(planet.minerai),
        silicium: Number(planet.silicium),
        hydrogene: Number(planet.hydrogene),
        mineraiMineLevel: buildingLevels[mineraiMineId] ?? 0,
        siliciumMineLevel: buildingLevels[siliciumMineId] ?? 0,
        hydrogeneSynthLevel: buildingLevels[hydrogeneSynthId] ?? 0,
        solarPlantLevel: buildingLevels[solarPlantId] ?? 0,
        storageMineraiLevel: buildingLevels[storageMineraiId] ?? 0,
        storageSiliciumLevel: buildingLevels[storageSiliciumId] ?? 0,
        storageHydrogeneLevel: buildingLevels[storageHydrogeneId] ?? 0,
        maxTemp: planet.maxTemp,
        solarSatelliteCount: satCountMap.get(planet.id) ?? 0,
        isHomePlanet: planet.planetClassId === homeworldTypeId,
        mineraiMinePercent: planet.mineraiMinePercent,
        siliciumMinePercent: planet.siliciumMinePercent,
        hydrogeneSynthPercent: planet.hydrogeneSynthPercent,
      },
      planet.resourcesUpdatedAt,
      now,
      bonus,
    );
```

- [ ] **Step 4: Update call sites**

In `apps/api/src/workers/worker.ts` (or wherever `resourceTick` is called), pass `gameConfigService`:

```typescript
await resourceTick(db, gameConfigService);
```

Check for other call sites:

```bash
cd /Users/julienaubree/_projet/exilium && grep -rn 'resourceTick(' apps/api/src/
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p apps/api/tsconfig.json
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/cron/resource-tick.ts apps/api/src/workers/worker.ts
git commit -m "feat(api): migrate resource-tick to role-based building lookups"
```

---

### Task 8: Migrate planet.service.ts to role-based lookups

**Files:**
- Modify: `apps/api/src/modules/planet/planet.service.ts` (lines 51, 59)

The `createHomePlanet` method uses `'homeworld'` as a string literal in two places: `planetClassId: 'homeworld'` and `getRandomPlanetImageIndex('homeworld', assetsDir)`. The file already imports `GameConfigService` and uses it to fetch config at line 20.

- [ ] **Step 1: Add import**

At top of `planet.service.ts`, add:

```typescript
import { findPlanetTypeByRole } from '../../lib/config-helpers.js';
```

- [ ] **Step 2: Replace hardcoded `'homeworld'` references**

In `createHomePlanet`, after `const config = await gameConfigService.getFullConfig();` (line 20), add:

```typescript
      const homeworldType = findPlanetTypeByRole(config, 'homeworld');
```

Replace line 51:

```typescript
          planetClassId: homeworldType.id,
```

Replace line 59:

```typescript
          planetImageIndex: getRandomPlanetImageIndex(homeworldType.id, assetsDir),
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p apps/api/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/planet/planet.service.ts
git commit -m "feat(api): migrate planet.service to role-based homeworld lookup"
```

---

### Task 9: Migrate pve.service.ts to role-based lookups

**Files:**
- Modify: `apps/api/src/modules/pve/pve.service.ts` (line 42)

The `getMissionCenterLevel` method uses raw SQL with `pb.building_id = 'missionCenter'`. The file already has `gameConfigService` in scope (line 14).

- [ ] **Step 1: Add import**

At top of `pve.service.ts`, add:

```typescript
import { findBuildingByRole } from '../../lib/config-helpers.js';
```

- [ ] **Step 2: Replace hardcoded `'missionCenter'` in raw SQL**

Replace the `getMissionCenterLevel` method (lines 36-45):

```typescript
    async getMissionCenterLevel(userId: string): Promise<number> {
      const config = await gameConfigService.getFullConfig();
      const missionCenterDef = findBuildingByRole(config, 'mission_center');
      const result = await db.execute(sql`
        SELECT COALESCE(MAX(pb.level), 0) as max_level
        FROM planet_buildings pb
        JOIN planets p ON p.id = pb.planet_id
        WHERE p.user_id = ${userId}
          AND pb.building_id = ${missionCenterDef.id}
      `);
      return Number(result[0]?.max_level ?? 0);
    },
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p apps/api/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/pve/pve.service.ts
git commit -m "feat(api): migrate pve.service to role-based missionCenter lookup"
```

---

### Task 10: Add `role` column to admin UI pages

**Files:**
- Modify: `apps/admin/src/pages/Ships.tsx`
- Modify: `apps/admin/src/pages/Buildings.tsx`
- Modify: `apps/admin/src/pages/PlanetTypes.tsx`

- [ ] **Step 1: Add `role` field to Ships admin page**

In `apps/admin/src/pages/Ships.tsx`, add to `FIELDS` array (after `sortOrder` entry, around line 24):

```typescript
  { key: 'role', label: 'Rôle', type: 'text' as const },
```

In the table `<thead>`, add a `<th>Rôle</th>` column.

In the table `<tbody>`, add a cell displaying the role:

```tsx
<td className="font-mono text-xs text-gray-500">{s.role ?? '-'}</td>
```

In the edit modal `values`, add `role: editingShip.role ?? ''`.

In the create modal `values`, add `role: ''`.

In the `onSave` for both create and update, add `role: values.role as string || null`.

- [ ] **Step 2: Add `role` field to Buildings admin page**

In `apps/admin/src/pages/Buildings.tsx`:

1. In `getFields()` function (around line 11), add after the `sortOrder` entry:

```typescript
  { key: 'role', label: 'Rôle', type: 'text' as const },
```

2. `getCreateFields()` (line 25) spreads `getFields()`, so role will appear in create modal automatically.

3. In the table `<thead>`, add `<th>Rôle</th>` column.

4. In the table `<tbody>`, add a cell:

```tsx
<td className="font-mono text-xs text-gray-500">{b.role ?? '-'}</td>
```

5. In the edit modal `values` object, add: `role: editingBuilding.role ?? ''`

6. In the create modal `values` object, add: `role: ''`

7. In both `onSave` callbacks, add `role: (values.role as string) || null` to the mutation data.

- [ ] **Step 3: Add `role` field to PlanetTypes admin page**

In `apps/admin/src/pages/PlanetTypes.tsx`:

1. Add to `FIELDS` array (around line 21, after `sortOrder`):

```typescript
  { key: 'role', label: 'Rôle', type: 'text' as const },
```

2. `EDIT_FIELDS` (line 24) filters `id` from `FIELDS`, so `role` will appear in edit modal automatically.

3. In `defaultForm()` (line 26), add: `role: ''`

4. In the table `<thead>`, add `<th>Rôle</th>` column.

5. In the table `<tbody>`, add a cell: `<td className="font-mono text-xs text-gray-500">{pt.role ?? '-'}</td>`

6. In the create `onSave`, ensure `role` is sent as: `role: String(values.role) || null`

7. In the edit `onSave`, same: `role: String(values.role) || null`

- [ ] **Step 4: Build admin app to verify**

```bash
cd /Users/julienaubree/_projet/exilium/apps/admin && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/pages/Ships.tsx apps/admin/src/pages/Buildings.tsx apps/admin/src/pages/PlanetTypes.tsx
git commit -m "feat(admin): add role column to Ships, Buildings, PlanetTypes pages"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd /Users/julienaubree/_projet/exilium && npx vitest run
```

- [ ] **Step 2: Build entire project**

```bash
cd /Users/julienaubree/_projet/exilium && npm run build
```

- [ ] **Step 3: Grep for remaining direct string references (verification only)**

```bash
cd /Users/julienaubree/_projet/exilium && grep -rn "'recycler'" apps/api/src/modules/fleet/ --include='*.ts'
cd /Users/julienaubree/_projet/exilium && grep -rn "'espionageProbe'" apps/api/src/modules/fleet/ --include='*.ts'
cd /Users/julienaubree/_projet/exilium && grep -rn "'prospector'" apps/api/src/modules/fleet/ --include='*.ts'
cd /Users/julienaubree/_projet/exilium && grep -rn "'colonyShip'" apps/api/src/modules/fleet/ --include='*.ts'
cd /Users/julienaubree/_projet/exilium && grep -rn "'homeworld'" apps/api/src/modules/ apps/api/src/cron/ --include='*.ts'
cd /Users/julienaubree/_projet/exilium && grep -rn "'missionCenter'" apps/api/src/modules/ --include='*.ts'
cd /Users/julienaubree/_projet/exilium && grep -rn "buildingLevels\['mineraiMine'\]" apps/api/src/ --include='*.ts'
```

All of these should return 0 results (except possibly in seed files or migration scripts, which are acceptable).

- [ ] **Step 4: Commit final state if any fixes needed**

```bash
git add -A && git commit -m "fix: address remaining hardcoded entity references"
```

**Note:** Frontend files (`apps/web/src/pages/Buildings.tsx`, `BuildingDetailContent.tsx`, `entity-details.ts`) still use hardcoded building IDs in `switch` statements for production/energy/storage display logic. These are **frontend display concerns** driven by game-engine formula functions (`mineraiProduction`, `solarPlantEnergy`, etc.) which are SP5 scope (game-engine constants cleanup). SP4 only covers backend business logic.
