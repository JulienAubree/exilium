# PvE Missions System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mining (asteroid belts) and PvE combat (pirates) missions, dispatched via the existing fleet system, gated by a Mission Center building.

**Architecture:** Extend the fleet module with two new mission types (`mine`, `pirate`). New PvE module handles mission pool generation, asteroid belt management, and pirate combat resolution. New DB tables for belts, deposits, missions, and pirate templates. New frontend Missions page + galaxy/fleet UI extensions.

**Tech Stack:** TypeScript, Fastify/tRPC, Drizzle ORM, PostgreSQL, BullMQ, React 19, Vite, Tailwind, Vitest

**Spec:** `docs/superpowers/specs/2026-03-17-pve-missions-design.md`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `packages/db/src/schema/asteroid-belts.ts` | Drizzle schema for `asteroid_belts` + `asteroid_deposits` tables |
| `packages/db/src/schema/pve-missions.ts` | Drizzle schema for `pve_missions` + `pirate_templates` tables |
| `packages/game-engine/src/formulas/pve.ts` | Extraction formula, pool size, extraction duration |
| `packages/game-engine/src/formulas/__tests__/pve.test.ts` | Tests for PvE formulas |
| `apps/api/src/modules/pve/asteroid-belt.service.ts` | Belt lazy creation, deposit generation, extraction, regeneration |
| `apps/api/src/modules/pve/pirate.service.ts` | Template selection, combat resolution wrapper, reward calc |
| `apps/api/src/modules/pve/pve.service.ts` | Mission pool CRUD, generation, accumulation, FIFO |
| `apps/api/src/modules/pve/pve.router.ts` | tRPC router for PvE endpoints |
| `apps/web/src/pages/Missions.tsx` | Missions page — pool display, mission cards, send actions |

### Modified files
| File | Changes |
|------|---------|
| `packages/db/src/schema/index.ts` | Export new schemas |
| `packages/db/src/schema/fleet-events.ts` | Add `metadata` JSONB column, `pveMissionId` FK, extend enum |
| `packages/game-engine/src/constants/buildings.ts` | Add `'missionCenter'` to BuildingId + BUILDINGS |
| `packages/game-engine/src/constants/ships.ts` | Update prospector prerequisites |
| `packages/game-engine/src/index.ts` | Export PvE formulas |
| `apps/api/src/modules/universe/universe.config.ts` | positions: 15 → 16 |
| `apps/api/src/modules/fleet/fleet.router.ts` | Add `mine`/`pirate` missions, `prospector`/`explorer` ships, position max 16 |
| `apps/api/src/modules/fleet/fleet.service.ts` | Add `mine`/`pirate` to SendFleetInput, processArrival/Return cases, colonization guard, scheduleReturnWithDelay |
| `apps/api/src/workers/fleet-arrival.worker.ts` | Pass PvE services to createFleetService |
| `apps/api/src/workers/fleet-return.worker.ts` | Pass PvE services to createFleetService |
| `apps/api/src/modules/building/building.router.ts` | Add `'missionCenter'` to buildingIds |
| `apps/api/src/modules/galaxy/galaxy.service.ts` | 16-slot array, belt rendering at pos 8/16 |
| `apps/api/src/trpc/app-router.ts` | Register PvE router |
| `apps/api/src/workers/worker.ts` | Add mission-refresh cron |
| `apps/web/src/router.tsx` | Add `/missions` route |
| `apps/web/src/pages/Galaxy.tsx` | 16 positions, belt icons |
| `apps/web/src/pages/Fleet.tsx` | Support `mine`/`pirate` missions, position max 16, pre-fill from query params |
| `apps/web/src/pages/Movements.tsx` | "Extracting..." status display |

---

## Chunk 1: Foundation — Universe Expansion + Building + DB Schema

### Task 1: Expand universe from 15 to 16 positions

**Files:**
- Modify: `apps/api/src/modules/universe/universe.config.ts:6`
- Modify: `apps/api/src/modules/fleet/fleet.router.ts:5-10,20`
- Modify: `apps/api/src/modules/galaxy/galaxy.service.ts:25-32`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts:528-548`

- [ ] **Step 1: Update UNIVERSE_CONFIG**

In `apps/api/src/modules/universe/universe.config.ts`:
```typescript
export const UNIVERSE_CONFIG = {
  name: 'Universe 1',
  speed: 1,
  galaxies: 9,
  systems: 499,
  positions: 16,  // was 15
  maxPlanetsPerPlayer: 9,
  debrisRatio: 0.3,
  lootRatio: 0.5,
} as const;
```

- [ ] **Step 2: Update fleet router validation and add new missions/ships**

In `apps/api/src/modules/fleet/fleet.router.ts`:
```typescript
const shipIds = [
  'smallCargo', 'largeCargo', 'lightFighter', 'heavyFighter',
  'cruiser', 'battleship', 'espionageProbe', 'colonyShip', 'recycler',
  'prospector', 'explorer',  // add these
] as const;

const missionTypes = ['transport', 'station', 'spy', 'attack', 'colonize', 'recycle', 'mine', 'pirate'] as const;
```

Update `targetPosition` max from 15 to 16:
```typescript
targetPosition: z.number().int().min(1).max(16),
```

Add `pveMissionId` to the send input Zod schema:
```typescript
pveMissionId: z.string().uuid().optional(),
```

- [ ] **Step 3: Update SendFleetInput type in fleet.service.ts**

In `apps/api/src/modules/fleet/fleet.service.ts`, update the `SendFleetInput` interface:
```typescript
interface SendFleetInput {
  originPlanetId: string;
  targetGalaxy: number;
  targetSystem: number;
  targetPosition: number;
  mission: 'transport' | 'station' | 'spy' | 'attack' | 'colonize' | 'recycle' | 'mine' | 'pirate';
  ships: Record<string, number>;
  mineraiCargo?: number;
  siliciumCargo?: number;
  hydrogeneCargo?: number;
  pveMissionId?: string;  // optional link to PvE mission
}
```

- [ ] **Step 4: Add colonization guard for belt positions**

In `apps/api/src/modules/fleet/fleet.service.ts`, in the `processColonize` method (around line 538), add a check before the existing "position occupied" check:
```typescript
// Reject colonization of asteroid belt positions
const BELT_POSITIONS = [8, 16];
if (BELT_POSITIONS.includes(event.targetPosition)) {
  const ships = event.ships as Record<string, number>;
  await this.scheduleReturn(
    event.id, event.originPlanetId,
    { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
    ships,
    Number(event.mineraiCargo), Number(event.siliciumCargo), Number(event.hydrogeneCargo),
  );
  return;
}
```

- [ ] **Step 5: Expand galaxy service to 16 slots**

In `apps/api/src/modules/galaxy/galaxy.service.ts`, change the slot array initialization from 15 to 16, and mark positions 8 and 16 as belt slots. The exact change depends on the current code but the slot array should be `Array(16).fill(null)` and positions 8/16 should be flagged as `type: 'belt'` in the returned data.

- [ ] **Step 6: Update planet type seed**

In `packages/db/src/seed-game-config.ts`, update the temperate planet type:
```typescript
{
  id: 'temperate',
  name: 'Tempérée',
  description: 'Planète équilibrée sans bonus ni malus.',
  positions: [7, 9],  // was [7, 8, 9] — position 8 is now a belt
  // ...rest unchanged
}
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: expand universe to 16 positions, add belt position guards"
```

---

### Task 2: Add Mission Center building definition

**Files:**
- Modify: `packages/game-engine/src/constants/buildings.ts:1-13,25+`
- Modify: `apps/api/src/modules/building/building.router.ts:6-17`
- Modify: `packages/db/src/seed-game-config.ts` (building seed)

- [ ] **Step 1: Add missionCenter to BuildingId type and BUILDINGS constant**

In `packages/game-engine/src/constants/buildings.ts`:

Add `'missionCenter'` to the `BuildingId` type union:
```typescript
export type BuildingId =
  | 'mineraiMine' | 'siliciumMine' | 'hydrogeneSynth' | 'solarPlant'
  | 'robotics' | 'shipyard' | 'arsenal' | 'commandCenter'
  | 'researchLab' | 'storageMinerai' | 'storageSilicium' | 'storageHydrogene'
  | 'missionCenter';
```

Add the full definition to the `BUILDINGS` record:
```typescript
missionCenter: {
  id: 'missionCenter',
  name: 'Centre de missions',
  description: 'Détecte les opportunités dans le système solaire : gisements miniers et menaces pirates.',
  baseCost: { minerai: 5000, silicium: 3000, hydrogene: 1000 },
  costFactor: 1.8,
  baseTime: 300,
  prerequisites: [
    { buildingId: 'shipyard', level: 3 },
    { buildingId: 'researchLab', level: 1 },
  ],
},
```

- [ ] **Step 2: Add missionCenter to building router validation**

In `apps/api/src/modules/building/building.router.ts`:
```typescript
const buildingIds = [
  'mineraiMine', 'siliciumMine', 'hydrogeneSynth', 'solarPlant',
  'robotics', 'shipyard', 'researchLab', 'storageMinerai',
  'storageSilicium', 'storageHydrogene',
  'missionCenter',  // add
] as const;
```

- [ ] **Step 3: Add Mission Center to seed data**

In `packages/db/src/seed-game-config.ts`, add a building seed entry for missionCenter with the same cost/factor/time values as above, categoryId matching the appropriate category (e.g., `'facility'` if that category exists, or create one), and prerequisites array `[{ buildingId: 'shipyard', level: 3 }, { buildingId: 'researchLab', level: 1 }]`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Mission Center building definition"
```

---

### Task 3: Update Prospector prerequisites

**Files:**
- Modify: `packages/game-engine/src/constants/ships.ts:138-147`
- Modify: `packages/db/src/seed-game-config.ts` (ship seed for prospector)

- [ ] **Step 1: Update SHIPS.prospector.prerequisites**

In `packages/game-engine/src/constants/ships.ts`:
```typescript
prospector: {
  id: 'prospector',
  name: 'Prospecteur',
  description: 'Vaisseau minier pour l\'extraction de ressources.',
  cost: { minerai: 3000, silicium: 1000, hydrogene: 500 },
  countColumn: 'prospector',
  prerequisites: {
    buildings: [
      { buildingId: 'missionCenter', level: 1 },
      { buildingId: 'shipyard', level: 2 },
    ],
  },
},
```

- [ ] **Step 2: Update prospector seed data to match**

In `packages/db/src/seed-game-config.ts`, update the prospector's seed entry:
- Prerequisites: add missionCenter level 1, change shipyard to level 2
- **Also verify the runtime stats match the game-engine constants:** costMinerai: 3000, costSilicium: 1000, costHydrogene: 500, baseSpeed: 3000, fuelConsumption: 50, cargoCapacity: 10000, weapons: 5, shield: 10, armor: 5000. If the seed file has different values (e.g., cost 1500/500/0, cargo 500), update them to match — the seed is the runtime source of truth and must align with the extraction formula calibration.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: update prospector prerequisites to require Mission Center"
```

---

### Task 4: DB schema — extend fleet_events + new enum values

**Files:**
- Modify: `packages/db/src/schema/fleet-events.ts`

- [ ] **Step 1: Extend fleet_mission enum**

In `packages/db/src/schema/fleet-events.ts`, add `'mine'` and `'pirate'` to the enum:
```typescript
export const fleetMissionEnum = pgEnum('fleet_mission', [
  'transport', 'station', 'spy', 'attack', 'colonize', 'recycle',
  'mine', 'pirate',  // add
]);
```

Note: The Drizzle migration will generate `ALTER TYPE fleet_mission ADD VALUE`. This must be run as a separate non-transactional migration step. When generating the migration, verify this is handled correctly.

- [ ] **Step 2: Add metadata and pveMissionId columns**

In `packages/db/src/schema/fleet-events.ts`, add two columns to the `fleetEvents` table:
```typescript
metadata: jsonb('metadata'),  // nullable, for PvE bonus ships etc.
pveMissionId: uuid('pve_mission_id'),  // nullable FK, added after pve_missions table exists
```

Note: The FK to `pve_missions` will be added via migration after Task 5 creates the table. For now, just add the column without the FK constraint, or add both in the same migration batch.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: extend fleet_events with metadata column and mine/pirate missions"
```

---

### Task 5: DB schema — new PvE tables

**Files:**
- Create: `packages/db/src/schema/asteroid-belts.ts`
- Create: `packages/db/src/schema/pve-missions.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create asteroid-belts schema**

Create `packages/db/src/schema/asteroid-belts.ts`:
```typescript
import { pgTable, uuid, smallint, varchar, numeric, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const asteroidBelts = pgTable('asteroid_belts', {
  id: uuid('id').primaryKey().defaultRandom(),
  galaxy: smallint('galaxy').notNull(),
  system: smallint('system').notNull(),
  position: smallint('position').notNull(),  // 8 or 16
}, (table) => [
  uniqueIndex('unique_belt_coords').on(table.galaxy, table.system, table.position),
]);

export const asteroidDeposits = pgTable('asteroid_deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  beltId: uuid('belt_id').notNull().references(() => asteroidBelts.id, { onDelete: 'cascade' }),
  resourceType: varchar('resource_type', { length: 32 }).notNull(),  // 'minerai' | 'silicium' | 'hydrogene'
  totalQuantity: numeric('total_quantity', { precision: 20, scale: 2 }).notNull(),
  remainingQuantity: numeric('remaining_quantity', { precision: 20, scale: 2 }).notNull(),
  regeneratesAt: timestamp('regenerates_at', { withTimezone: true }),  // set when depleted
}, (table) => [
  index('deposits_belt_remaining_idx').on(table.beltId, table.remainingQuantity),
]);
```

- [ ] **Step 2: Create pve-missions schema**

Create `packages/db/src/schema/pve-missions.ts`:
```typescript
import { pgTable, uuid, varchar, jsonb, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const pveMissions = pgTable('pve_missions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  missionType: varchar('mission_type', { length: 32 }).notNull(),  // 'mine' | 'pirate'
  parameters: jsonb('parameters').notNull().default('{}'),  // coords, depositId, templateId, tier
  rewards: jsonb('rewards').notNull().default('{}'),  // expected resources, bonus ships
  difficultyTier: varchar('difficulty_tier', { length: 16 }),  // 'easy' | 'medium' | 'hard' (combat only)
  status: varchar('status', { length: 16 }).notNull().default('available'),  // available | in_progress | completed | expired
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => [
  index('pve_missions_user_status_idx').on(table.userId, table.status),
]);

export const pirateTemplates = pgTable('pirate_templates', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  tier: varchar('tier', { length: 16 }).notNull(),  // 'easy' | 'medium' | 'hard'
  ships: jsonb('ships').notNull(),  // Record<string, number>
  techs: jsonb('techs').notNull(),  // { weapons, shielding, armor }
  rewards: jsonb('rewards').notNull(),  // { minerai, silicium, hydrogene, bonusShips }
  centerLevelMin: integer('center_level_min').notNull(),
  centerLevelMax: integer('center_level_max').notNull(),
});
```

- [ ] **Step 3: Export new schemas from index**

In `packages/db/src/schema/index.ts`, add:
```typescript
export * from './asteroid-belts.js';
export * from './pve-missions.js';
```

- [ ] **Step 4: Add FK from fleet_events to pve_missions**

Update `packages/db/src/schema/fleet-events.ts` to import `pveMissions` and add the FK:
```typescript
import { pveMissions } from './pve-missions.js';

// In the fleetEvents table definition, update pveMissionId:
pveMissionId: uuid('pve_mission_id').references(() => pveMissions.id, { onDelete: 'set null' }),
```

- [ ] **Step 5: Generate and run migration**

```bash
cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/db drizzle-kit generate
```

Review the generated migration. Ensure the `ALTER TYPE fleet_mission ADD VALUE` statements are present and will work (they cannot be inside a transaction). If Drizzle wraps them in a transaction, the migration SQL must be manually adjusted.

```bash
pnpm --filter @ogame-clone/db drizzle-kit migrate
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add PvE database tables (belts, deposits, missions, pirate templates)"
```

---

### Task 6: Seed pirate templates

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Add pirate template seed data**

Add 8 archetypes × 3 tiers = 24 templates. Each template has: id, name, tier, ships (Record<string, number>), techs ({weapons, shielding, armor}), rewards ({minerai, silicium, hydrogene, bonusShips}), centerLevelMin, centerLevelMax.

Example templates (add all to the seed file):

```typescript
const pirateTemplatesSeed = [
  // ── Easy tier (center level 3-10) ──
  {
    id: 'scout_patrol_easy',
    name: 'Patrouille pirate',
    tier: 'easy',
    ships: { lightFighter: 5 },
    techs: { weapons: 0, shielding: 0, armor: 0 },
    rewards: { minerai: 3000, silicium: 1500, hydrogene: 500, bonusShips: [] },
    centerLevelMin: 3, centerLevelMax: 4,
  },
  {
    id: 'raider_squad_easy',
    name: 'Escouade de pillards',
    tier: 'easy',
    ships: { lightFighter: 8, heavyFighter: 2 },
    techs: { weapons: 1, shielding: 0, armor: 1 },
    rewards: { minerai: 5000, silicium: 2500, hydrogene: 1000, bonusShips: [] },
    centerLevelMin: 4, centerLevelMax: 6,
  },
  {
    id: 'smuggler_convoy_easy',
    name: 'Convoi de contrebandiers',
    tier: 'easy',
    ships: { lightFighter: 3, smallCargo: 5 },
    techs: { weapons: 1, shielding: 1, armor: 0 },
    rewards: { minerai: 6000, silicium: 4000, hydrogene: 1500, bonusShips: [] },
    centerLevelMin: 5, centerLevelMax: 10,
  },
  // ── Medium tier (center level 4-10) ──
  {
    id: 'war_party_medium',
    name: 'Bande de guerre pirate',
    tier: 'medium',
    ships: { lightFighter: 15, heavyFighter: 5, cruiser: 2 },
    techs: { weapons: 2, shielding: 1, armor: 2 },
    rewards: {
      minerai: 15000, silicium: 8000, hydrogene: 3000,
      bonusShips: [{ shipId: 'lightFighter', count: 2, chance: 0.3 }],
    },
    centerLevelMin: 4, centerLevelMax: 6,
  },
  {
    id: 'shield_wall_medium',
    name: 'Mur de boucliers pirate',
    tier: 'medium',
    ships: { heavyFighter: 12, cruiser: 3 },
    techs: { weapons: 1, shielding: 3, armor: 2 },
    rewards: {
      minerai: 18000, silicium: 10000, hydrogene: 4000,
      bonusShips: [{ shipId: 'lightFighter', count: 3, chance: 0.3 }],
    },
    centerLevelMin: 5, centerLevelMax: 8,
  },
  {
    id: 'swarm_medium',
    name: 'Essaim pirate',
    tier: 'medium',
    ships: { lightFighter: 30, heavyFighter: 8 },
    techs: { weapons: 2, shielding: 1, armor: 1 },
    rewards: {
      minerai: 20000, silicium: 12000, hydrogene: 5000,
      bonusShips: [{ shipId: 'lightFighter', count: 3, chance: 0.3 }],
    },
    centerLevelMin: 6, centerLevelMax: 10,
  },
  // ── Hard tier (center level 6-10) ──
  {
    id: 'battlegroup_hard',
    name: 'Groupe de combat pirate',
    tier: 'hard',
    ships: { heavyFighter: 15, cruiser: 8, battleship: 3 },
    techs: { weapons: 3, shielding: 2, armor: 3 },
    rewards: {
      minerai: 50000, silicium: 30000, hydrogene: 15000,
      bonusShips: [{ shipId: 'cruiser', count: 1, chance: 0.2 }],
    },
    centerLevelMin: 6, centerLevelMax: 8,
  },
  {
    id: 'heavy_assault_hard',
    name: 'Assaut lourd pirate',
    tier: 'hard',
    ships: { cruiser: 12, battleship: 5 },
    techs: { weapons: 4, shielding: 3, armor: 4 },
    rewards: {
      minerai: 70000, silicium: 40000, hydrogene: 20000,
      bonusShips: [{ shipId: 'cruiser', count: 2, chance: 0.2 }],
    },
    centerLevelMin: 7, centerLevelMax: 10,
  },
  {
    id: 'pirate_armada_hard',
    name: 'Armada pirate',
    tier: 'hard',
    ships: { heavyFighter: 20, cruiser: 15, battleship: 8 },
    techs: { weapons: 5, shielding: 4, armor: 5 },
    rewards: {
      minerai: 100000, silicium: 60000, hydrogene: 30000,
      bonusShips: [{ shipId: 'battleship', count: 1, chance: 0.2 }],
    },
    centerLevelMin: 8, centerLevelMax: 10,
  },
];
```

Add the insert logic in the seed function to upsert these into the `pirate_templates` table.

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: seed pirate templates (9 archetypes × 3 tiers)"
```

---

## Chunk 2: Game Engine + Backend Services

### Task 7: PvE formulas in game-engine

**Files:**
- Create: `packages/game-engine/src/formulas/pve.ts`
- Create: `packages/game-engine/src/formulas/__tests__/pve.test.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/game-engine/src/formulas/__tests__/pve.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  baseExtraction,
  totalExtracted,
  extractionDuration,
  poolSize,
  accumulationCap,
} from '../pve.js';

describe('baseExtraction', () => {
  it('returns 2000 at center level 1', () => {
    expect(baseExtraction(1)).toBe(2000);
  });
  it('returns 2800 at center level 2', () => {
    expect(baseExtraction(2)).toBe(2800);
  });
  it('returns 3600 at center level 3', () => {
    expect(baseExtraction(3)).toBe(3600);
  });
  it('returns 9200 at center level 10', () => {
    expect(baseExtraction(10)).toBe(9200);
  });
});

describe('totalExtracted', () => {
  it('caps at 10 prospectors', () => {
    expect(totalExtracted(1, 15, 100000, 500000)).toBe(2000 * 10);
  });
  it('caps at cargo capacity', () => {
    expect(totalExtracted(1, 3, 5000, 100000)).toBe(5000);
  });
  it('caps at deposit remaining', () => {
    expect(totalExtracted(1, 3, 100000, 1000)).toBe(1000);
  });
  it('normal case: 3 prospectors at level 1', () => {
    expect(totalExtracted(1, 3, 100000, 100000)).toBe(6000);
  });
});

describe('extractionDuration', () => {
  it('returns 15 min at level 1', () => {
    expect(extractionDuration(1)).toBe(15);
  });
  it('returns 5 min at level 11 (floor)', () => {
    expect(extractionDuration(11)).toBe(5);
  });
  it('returns 5 min at level 15 (floor)', () => {
    expect(extractionDuration(15)).toBe(5);
  });
  it('returns 10 min at level 6', () => {
    expect(extractionDuration(6)).toBe(10);
  });
});

describe('poolSize', () => {
  it('returns 3 at level 1-2', () => {
    expect(poolSize(1)).toBe(3);
    expect(poolSize(2)).toBe(3);
  });
  it('returns 4 at level 3-4', () => {
    expect(poolSize(3)).toBe(4);
    expect(poolSize(4)).toBe(4);
  });
  it('returns 5 at level 5-6', () => {
    expect(poolSize(5)).toBe(5);
    expect(poolSize(6)).toBe(5);
  });
  it('returns 6 (cap) at level 7+', () => {
    expect(poolSize(7)).toBe(6);
    expect(poolSize(10)).toBe(6);
  });
});

describe('accumulationCap', () => {
  it('is 2x pool size', () => {
    expect(accumulationCap(1)).toBe(6);
    expect(accumulationCap(3)).toBe(8);
    expect(accumulationCap(7)).toBe(12);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/game-engine test -- --run pve.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement PvE formulas**

Create `packages/game-engine/src/formulas/pve.ts`:
```typescript
/**
 * Base extraction per prospector, scales with Mission Center level.
 * Formula: 2000 + 800 * (centerLevel - 1)
 */
export function baseExtraction(centerLevel: number): number {
  return 2000 + 800 * (centerLevel - 1);
}

/**
 * Total resources extracted for a mining trip.
 * Capped by: 10 prospectors max, fleet cargo capacity, deposit remaining.
 */
export function totalExtracted(
  centerLevel: number,
  nbProspectors: number,
  fleetCargoCapacity: number,
  depositRemaining: number,
): number {
  const effectiveProspectors = Math.min(nbProspectors, 10);
  const extracted = baseExtraction(centerLevel) * effectiveProspectors;
  return Math.min(extracted, fleetCargoCapacity, depositRemaining);
}

/**
 * Extraction duration in minutes at the belt.
 * Formula: max(5, 16 - centerLevel)
 * Level 1 = 15 min, decreases by 1 min per level, floor at 5 min.
 */
export function extractionDuration(centerLevel: number): number {
  return Math.max(5, 16 - centerLevel);
}

/**
 * Visible pool size based on Mission Center level.
 */
export function poolSize(centerLevel: number): number {
  if (centerLevel <= 2) return 3;
  if (centerLevel <= 4) return 4;
  if (centerLevel <= 6) return 5;
  return 6;
}

/**
 * Max accumulated missions (2x pool size).
 */
export function accumulationCap(centerLevel: number): number {
  return poolSize(centerLevel) * 2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/julienaubree/_projet/ogame-clone && pnpm --filter @ogame-clone/game-engine test -- --run pve.test
```

Expected: all PASS.

- [ ] **Step 5: Export from game-engine index**

In `packages/game-engine/src/index.ts`, add:
```typescript
export * from './formulas/pve.js';
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add PvE formulas (extraction, pool size, duration)"
```

---

### Task 8: Asteroid Belt Service

**Files:**
- Create: `apps/api/src/modules/pve/asteroid-belt.service.ts`

- [ ] **Step 1: Create the asteroid belt service**

Create `apps/api/src/modules/pve/asteroid-belt.service.ts`:

```typescript
import { eq, and, sql, lte, isNotNull } from 'drizzle-orm';
import { asteroidBelts, asteroidDeposits } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';

const BELT_POSITIONS = [8, 16] as const;
const DEPOSITS_PER_BELT = { min: 3, max: 5 };

// Position 8: smaller, mostly minerai/silicium
// Position 16: larger, more hydrogene
const DEPOSIT_CONFIG = {
  8: {
    resourceWeights: { minerai: 0.45, silicium: 0.45, hydrogene: 0.1 },
    quantityRange: { min: 20000, max: 40000 },
  },
  16: {
    resourceWeights: { minerai: 0.25, silicium: 0.25, hydrogene: 0.5 },
    quantityRange: { min: 40000, max: 80000 },
  },
} as const;

function pickResourceType(position: 8 | 16): 'minerai' | 'silicium' | 'hydrogene' {
  const weights = DEPOSIT_CONFIG[position].resourceWeights;
  const rand = Math.random();
  if (rand < weights.minerai) return 'minerai';
  if (rand < weights.minerai + weights.silicium) return 'silicium';
  return 'hydrogene';
}

function randomQuantity(position: 8 | 16, centerLevel: number): number {
  const { min, max } = DEPOSIT_CONFIG[position].quantityRange;
  const levelMultiplier = 1 + 0.15 * (centerLevel - 1);
  const base = min + Math.random() * (max - min);
  return Math.floor(base * levelMultiplier);
}

function randomRegenDelay(): number {
  // 4-8 hours in ms
  return (4 + Math.random() * 4) * 60 * 60 * 1000;
}

export function createAsteroidBeltService(db: Database) {
  return {
    /**
     * Get or lazily create a belt for a given system + position.
     */
    async getOrCreateBelt(galaxy: number, system: number, position: 8 | 16) {
      const existing = await db.select().from(asteroidBelts)
        .where(and(
          eq(asteroidBelts.galaxy, galaxy),
          eq(asteroidBelts.system, system),
          eq(asteroidBelts.position, position),
        ))
        .limit(1);

      if (existing.length > 0) return existing[0];

      const [belt] = await db.insert(asteroidBelts).values({
        galaxy, system, position,
      }).onConflictDoNothing().returning();

      // If conflict (race condition), fetch again
      if (!belt) {
        const [found] = await db.select().from(asteroidBelts)
          .where(and(
            eq(asteroidBelts.galaxy, galaxy),
            eq(asteroidBelts.system, system),
            eq(asteroidBelts.position, position),
          ))
          .limit(1);
        return found;
      }

      // Generate initial deposits
      await this.generateDeposits(belt.id, position, 1);
      return belt;
    },

    /**
     * Generate deposits for a belt.
     */
    async generateDeposits(beltId: string, position: 8 | 16, centerLevel: number) {
      const count = DEPOSITS_PER_BELT.min + Math.floor(Math.random() * (DEPOSITS_PER_BELT.max - DEPOSITS_PER_BELT.min + 1));
      const values = [];
      for (let i = 0; i < count; i++) {
        const qty = randomQuantity(position, centerLevel);
        values.push({
          beltId,
          resourceType: pickResourceType(position),
          totalQuantity: String(qty),
          remainingQuantity: String(qty),
        });
      }
      await db.insert(asteroidDeposits).values(values);
    },

    /**
     * Get all active deposits for a belt.
     */
    async getDeposits(beltId: string) {
      return db.select().from(asteroidDeposits)
        .where(eq(asteroidDeposits.beltId, beltId));
    },

    /**
     * Get deposits for a system (both belts).
     */
    async getSystemDeposits(galaxy: number, system: number) {
      const belts = await db.select().from(asteroidBelts)
        .where(and(
          eq(asteroidBelts.galaxy, galaxy),
          eq(asteroidBelts.system, system),
        ));

      const result: Record<number, typeof asteroidDeposits.$inferSelect[]> = {};
      for (const belt of belts) {
        result[belt.position] = await this.getDeposits(belt.id);
      }
      return result;
    },

    /**
     * Atomic partial extraction from a deposit. Extracts up to `amount`, returns actual extracted.
     * Supports partial extraction: if deposit has 3000 remaining and amount is 6000, extracts 3000.
     */
    async extractFromDeposit(depositId: string, amount: number): Promise<number> {
      const regenDelayMs = randomRegenDelay();
      const result = await db.execute(sql`
        UPDATE asteroid_deposits
        SET remaining_quantity = GREATEST(0, remaining_quantity - ${amount}),
            regenerates_at = CASE
              WHEN remaining_quantity - ${amount} <= 0
              THEN NOW() + make_interval(secs => ${regenDelayMs / 1000})
              ELSE NULL
            END
        WHERE id = ${depositId}
          AND remaining_quantity > 0
        RETURNING remaining_quantity,
          (remaining_quantity + ${amount} - GREATEST(0, remaining_quantity)) as extracted
      `);

      if (result.rows.length === 0) return 0;
      // extracted = old_remaining - new_remaining = min(amount, old_remaining)
      return Number(result.rows[0].extracted);
    },

    /**
     * Regenerate depleted deposits (called by cron).
     */
    async regenerateDepletedDeposits() {
      const depleted = await db.select({
        deposit: asteroidDeposits,
        belt: asteroidBelts,
      })
        .from(asteroidDeposits)
        .innerJoin(asteroidBelts, eq(asteroidDeposits.beltId, asteroidBelts.id))
        .where(and(
          lte(asteroidDeposits.remainingQuantity, '0'),
          isNotNull(asteroidDeposits.regeneratesAt),
          lte(asteroidDeposits.regeneratesAt, new Date()),
        ));

      for (const { deposit, belt } of depleted) {
        const pos = belt.position as 8 | 16;
        const qty = randomQuantity(pos, 1); // Use base level for regeneration
        await db.update(asteroidDeposits)
          .set({
            resourceType: pickResourceType(pos),
            totalQuantity: String(qty),
            remainingQuantity: String(qty),
            regeneratesAt: null,
          })
          .where(eq(asteroidDeposits.id, deposit.id));
      }
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add asteroid belt service (lazy creation, extraction, regeneration)"
```

---

### Task 9: Pirate Service

**Files:**
- Create: `apps/api/src/modules/pve/pirate.service.ts`

- [ ] **Step 1: Create the pirate service**

Create `apps/api/src/modules/pve/pirate.service.ts`:

```typescript
import { eq, and, gte, lte } from 'drizzle-orm';
import { pirateTemplates, fleetEvents } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import {
  simulateCombat,
  totalCargoCapacity,
  type CombatTechs,
  type UnitCombatStats,
} from '@ogame-clone/game-engine';
import type { GameConfigService } from '../admin/game-config.service.js';

interface PirateArrivalResult {
  outcome: 'attacker' | 'defender' | 'draw';
  survivingShips: Record<string, number>;
  loot: { minerai: number; silicium: number; hydrogene: number };
  bonusShips: Record<string, number>;
  attackerLosses: Record<string, number>;
}

export function createPirateService(db: Database, gameConfigService: GameConfigService) {
  return {
    /**
     * Pick a random pirate template matching the center level and tier.
     */
    async pickTemplate(centerLevel: number, tier: 'easy' | 'medium' | 'hard') {
      const templates = await db.select().from(pirateTemplates)
        .where(and(
          eq(pirateTemplates.tier, tier),
          lte(pirateTemplates.centerLevelMin, centerLevel),
          gte(pirateTemplates.centerLevelMax, centerLevel),
        ));

      if (templates.length === 0) return null;
      return templates[Math.floor(Math.random() * templates.length)];
    },

    /**
     * Process a pirate combat arrival. Returns combat results.
     */
    async processPirateArrival(
      playerShips: Record<string, number>,
      playerTechs: CombatTechs,
      templateId: string,
      fleetCargoCapacity: number,
    ): Promise<PirateArrivalResult> {
      const [template] = await db.select().from(pirateTemplates)
        .where(eq(pirateTemplates.id, templateId));

      if (!template) {
        throw new Error(`Pirate template ${templateId} not found`);
      }

      const pirateShips = template.ships as Record<string, number>;
      const pirateTechs = template.techs as CombatTechs;
      const rewards = template.rewards as {
        minerai: number;
        silicium: number;
        hydrogene: number;
        bonusShips: { shipId: string; count: number; chance: number }[];
      };

      // Load combat stats from game config
      const config = await gameConfigService.getFullConfig();
      const combatStats: Record<string, UnitCombatStats> = {};
      for (const [id, ship] of Object.entries(config.ships)) {
        combatStats[id] = { weapons: ship.weapons, shield: ship.shield, armor: ship.armor };
      }
      for (const [id, defense] of Object.entries(config.defenses)) {
        combatStats[id] = { weapons: defense.weapons, shield: defense.shield, armor: defense.armor };
      }

      const shipIds = new Set(Object.keys(config.ships));
      const shipCosts: Record<string, { minerai: number; silicium: number }> = {};
      for (const [id, ship] of Object.entries(config.ships)) {
        shipCosts[id] = { minerai: ship.costMinerai, silicium: ship.costSilicium };
      }

      // Build rapid fire map
      const rapidFireMap: Record<string, Record<string, number>> = {};
      for (const rf of config.rapidFire) {
        if (!rapidFireMap[rf.attackerId]) rapidFireMap[rf.attackerId] = {};
        rapidFireMap[rf.attackerId][rf.targetId] = rf.value;
      }

      const result = simulateCombat(
        playerShips,
        pirateShips,
        playerTechs,
        pirateTechs,
        combatStats,
        rapidFireMap,
        shipIds,
        shipCosts,
        new Set(), // no defenses for pirates
      );

      // Calculate surviving ships
      const survivingShips: Record<string, number> = {};
      for (const [type, count] of Object.entries(playerShips)) {
        const lost = result.attackerLosses[type] ?? 0;
        const remaining = count - lost;
        if (remaining > 0) survivingShips[type] = remaining;
      }

      // Victory: loot + bonus ships
      let loot = { minerai: 0, silicium: 0, hydrogene: 0 };
      let bonusShips: Record<string, number> = {};

      if (result.outcome === 'attacker') {
        // Cap loot to cargo capacity
        const totalLoot = rewards.minerai + rewards.silicium + rewards.hydrogene;
        const ratio = totalLoot > fleetCargoCapacity ? fleetCargoCapacity / totalLoot : 1;
        loot = {
          minerai: Math.floor(rewards.minerai * ratio),
          silicium: Math.floor(rewards.silicium * ratio),
          hydrogene: Math.floor(rewards.hydrogene * ratio),
        };

        // Roll for bonus ships
        for (const bonus of rewards.bonusShips) {
          if (Math.random() < bonus.chance) {
            bonusShips[bonus.shipId] = (bonusShips[bonus.shipId] ?? 0) + bonus.count;
          }
        }
      }

      return {
        outcome: result.outcome,
        survivingShips,
        loot,
        bonusShips,
        attackerLosses: result.attackerLosses,
      };
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add pirate service (template selection, combat resolution)"
```

---

### Task 10: PvE Mission Pool Service

**Files:**
- Create: `apps/api/src/modules/pve/pve.service.ts`

- [ ] **Step 1: Create the PvE service**

Create `apps/api/src/modules/pve/pve.service.ts`:

```typescript
import { eq, and, sql, asc, inArray } from 'drizzle-orm';
import { pveMissions, planetBuildings, planets } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import { poolSize, accumulationCap } from '@ogame-clone/game-engine';
import type { createAsteroidBeltService } from './asteroid-belt.service.js';
import type { createPirateService } from './pirate.service.js';

const BELT_POSITIONS = [8, 16] as const;

export function createPveService(
  db: Database,
  asteroidBeltService: ReturnType<typeof createAsteroidBeltService>,
  pirateService: ReturnType<typeof createPirateService>,
) {
  return {
    /**
     * Get available missions for a player.
     */
    async getMissions(userId: string) {
      return db.select().from(pveMissions)
        .where(and(
          eq(pveMissions.userId, userId),
          eq(pveMissions.status, 'available'),
        ))
        .orderBy(asc(pveMissions.createdAt));
    },

    /**
     * Get a player's Mission Center level (highest across all planets).
     */
    async getMissionCenterLevel(userId: string): Promise<number> {
      const result = await db.execute(sql`
        SELECT COALESCE(MAX(pb.level), 0) as max_level
        FROM planet_buildings pb
        JOIN planets p ON p.id = pb.planet_id
        WHERE p.user_id = ${userId}
          AND pb.building_id = 'missionCenter'
      `);
      return Number(result.rows[0]?.max_level ?? 0);
    },

    /**
     * Mark a mission as in_progress when fleet is dispatched.
     */
    async startMission(missionId: string) {
      await db.update(pveMissions)
        .set({ status: 'in_progress' })
        .where(eq(pveMissions.id, missionId));
    },

    /**
     * Mark a mission as completed.
     */
    async completeMission(missionId: string) {
      await db.update(pveMissions)
        .set({ status: 'completed' })
        .where(eq(pveMissions.id, missionId));
    },

    /**
     * Release a mission back to available (e.g., fleet recalled).
     */
    async releaseMission(missionId: string) {
      await db.update(pveMissions)
        .set({ status: 'available' })
        .where(eq(pveMissions.id, missionId));
    },

    /**
     * Generate missions for a player's pool. Called by cron.
     */
    async refreshPool(userId: string) {
      const centerLevel = await this.getMissionCenterLevel(userId);
      if (centerLevel === 0) return;

      const cap = accumulationCap(centerLevel);

      // Count available missions
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM pve_missions
        WHERE user_id = ${userId} AND status = 'available'
      `);
      const currentCount = Number(countResult.rows[0]?.count ?? 0);

      if (currentCount >= cap) {
        // At cap: FIFO replace oldest
        const oldest = await db.select({ id: pveMissions.id }).from(pveMissions)
          .where(and(
            eq(pveMissions.userId, userId),
            eq(pveMissions.status, 'available'),
          ))
          .orderBy(asc(pveMissions.createdAt))
          .limit(1);

        if (oldest.length > 0) {
          await db.delete(pveMissions).where(eq(pveMissions.id, oldest[0].id));
        }
      }

      // Get player's planets to find their systems
      const playerPlanets = await db.select({
        galaxy: planets.galaxy,
        system: planets.system,
      }).from(planets)
        .where(eq(planets.userId, userId));

      if (playerPlanets.length === 0) return;

      // Pick a random planet's system
      const planet = playerPlanets[Math.floor(Math.random() * playerPlanets.length)];

      // Weighted random: 60% mining, 40% combat
      const isMining = Math.random() < 0.6;

      if (isMining && centerLevel >= 1) {
        await this.generateMiningMission(userId, planet.galaxy, planet.system, centerLevel);
      } else if (!isMining && centerLevel >= 3) {
        await this.generatePirateMission(userId, planet.galaxy, planet.system, centerLevel);
      } else if (centerLevel >= 1) {
        // Fallback to mining if combat not unlocked
        await this.generateMiningMission(userId, planet.galaxy, planet.system, centerLevel);
      }
    },

    async generateMiningMission(userId: string, galaxy: number, system: number, centerLevel: number) {
      // Pick belt position: pos 8 always available, pos 16 requires level 2+
      const availablePositions: (8 | 16)[] = centerLevel >= 2 ? [8, 16] : [8];
      const position = availablePositions[Math.floor(Math.random() * availablePositions.length)];

      // Ensure belt exists (lazy creation)
      const belt = await asteroidBeltService.getOrCreateBelt(galaxy, system, position);
      const deposits = await asteroidBeltService.getDeposits(belt.id);

      // Find a deposit with remaining resources
      const available = deposits.filter(d => Number(d.remainingQuantity) > 0);
      if (available.length === 0) return; // No deposits available

      const deposit = available[Math.floor(Math.random() * available.length)];

      await db.insert(pveMissions).values({
        userId,
        missionType: 'mine',
        parameters: {
          galaxy, system, position,
          beltId: belt.id,
          depositId: deposit.id,
          resourceType: deposit.resourceType,
          remainingQuantity: Number(deposit.remainingQuantity),
        },
        rewards: {
          resourceType: deposit.resourceType,
          estimatedQuantity: Number(deposit.remainingQuantity),
        },
        status: 'available',
      });
    },

    async generatePirateMission(userId: string, galaxy: number, system: number, centerLevel: number) {
      // Determine available tiers
      let availableTiers: ('easy' | 'medium' | 'hard')[] = ['easy'];
      if (centerLevel >= 4) availableTiers.push('medium');
      if (centerLevel >= 6) availableTiers.push('hard');

      const tier = availableTiers[Math.floor(Math.random() * availableTiers.length)];
      const template = await pirateService.pickTemplate(centerLevel, tier);
      if (!template) return;

      // Random position in system (exclude belt positions)
      let position: number;
      do {
        position = 1 + Math.floor(Math.random() * 16);
      } while (position === 8 || position === 16);

      const rewards = template.rewards as {
        minerai: number; silicium: number; hydrogene: number;
        bonusShips: { shipId: string; count: number; chance: number }[];
      };

      await db.insert(pveMissions).values({
        userId,
        missionType: 'pirate',
        parameters: {
          galaxy, system, position,
          templateId: template.id,
        },
        rewards,
        difficultyTier: tier,
        status: 'available',
      });
    },

    /**
     * Expire old available missions (called by cron, optional cleanup).
     */
    async expireOldMissions() {
      await db.execute(sql`
        DELETE FROM pve_missions
        WHERE status = 'available'
          AND created_at < NOW() - INTERVAL '7 days'
      `);
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add PvE mission pool service (generation, accumulation, FIFO)"
```

---

## Chunk 3: Fleet Integration + Router + Workers

### Task 11: Fleet service integration (mine + pirate missions)

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

This is the most critical integration point. The fleet service needs:
1. Allow `targetPlanetId` to be null for mine/pirate missions in `sendFleet`
2. Add `mine` and `pirate` cases in `processArrival`
3. Handle bonus ships in `processReturn`

- [ ] **Step 1: Update sendFleet to support PvE missions**

In `apps/api/src/modules/fleet/fleet.service.ts`, the `sendFleet` method currently validates target planet existence. For mine/pirate missions, skip this validation since there's no target planet.

Add validation for mine missions (require at least 1 prospector):
```typescript
if (input.mission === 'mine') {
  const prospectorCount = input.ships['prospector'] ?? 0;
  if (prospectorCount === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Mining requires at least 1 prospector' });
  }
}
```

When creating the fleet event at line 186-205, add the `pveMissionId` field:
```typescript
pveMissionId: input.pveMissionId ?? null,
```

Set `targetPlanetId` to null for mine/pirate missions (skip target planet lookup for these).

Also add to the `sendFleet` method: when pveMissionId is provided, call `pveService.startMission(input.pveMissionId)` to mark it as in_progress.

**Important:** Add `pveMissions` and `gameEvents` to the imports from `@ogame-clone/db` at the top of fleet.service.ts.

- [ ] **Step 2: Add mine case in processArrival**

Add a new case for `'mine'` in the processArrival dispatch. It should:

1. Read the pveMissionId from event metadata
2. Load the PvE mission to get depositId
3. Get the player's Mission Center level
4. Calculate extraction amount using `totalExtracted()` formula
5. Call `asteroidBeltService.extractFromDeposit()` atomically
6. If extraction succeeds: set cargo on the fleet event, schedule delayed return (arrival + extraction duration)
7. If deposit is depleted: schedule immediate return with 0 cargo
8. Mark PvE mission as completed

```typescript
case 'mine': {
  const pveMissionId = event.pveMissionId;
  const mission = pveMissionId
    ? await db.select().from(pveMissions).where(eq(pveMissions.id, pveMissionId)).limit(1).then(r => r[0])
    : null;

  const ships = event.ships as Record<string, number>;
  const targetCoords = { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition };

  if (!mission) {
    await this.scheduleReturn(event.id, event.originPlanetId, targetCoords, ships, 0, 0, 0);
    break;
  }

  const params = mission.parameters as { depositId: string; resourceType: string };
  const centerLevel = await pveService.getMissionCenterLevel(event.userId);
  const prospectorCount = ships['prospector'] ?? 0;
  const config = await gameConfigService.getFullConfig();
  const shipStatsMap = buildShipStatsMap(config);
  const cargoCapacity = totalCargoCapacity(ships, shipStatsMap);

  // Fetch current deposit remaining for formula, then do atomic extraction
  const [deposit] = await db.select().from(asteroidDeposits)
    .where(eq(asteroidDeposits.id, params.depositId)).limit(1);
  const depositRemaining = deposit ? Number(deposit.remainingQuantity) : 0;
  const extractAmount = totalExtracted(centerLevel, prospectorCount, cargoCapacity, depositRemaining);

  // Atomic partial extraction — extracts up to extractAmount, returns actual extracted
  const extracted = await asteroidBeltService.extractFromDeposit(params.depositId, extractAmount);

  const cargo = { minerai: 0, silicium: 0, hydrogene: 0 };
  if (extracted > 0) {
    cargo[params.resourceType as keyof typeof cargo] = extracted;
  }

  // Update fleet event with cargo
  await db.update(fleetEvents).set({
    mineraiCargo: String(cargo.minerai),
    siliciumCargo: String(cargo.silicium),
    hydrogeneCargo: String(cargo.hydrogene),
  }).where(eq(fleetEvents.id, event.id));

  // Schedule delayed return (extraction time before travel back)
  const extractionMins = extractionDuration(centerLevel);
  const extractionMs = extractionMins * 60 * 1000;
  await this.scheduleReturnWithDelay(
    event.id, event.originPlanetId, targetCoords, ships,
    cargo.minerai, cargo.silicium, cargo.hydrogene,
    extractionMs,
  );

  await pveService.completeMission(mission.id);

  // Log mining reward
  if (extracted > 0) {
    await db.insert(gameEvents).values({
      userId: event.userId,
      planetId: event.originPlanetId,
      type: 'pve_mining_reward',
      payload: { resourceType: params.resourceType, amount: extracted },
    });
  }
  break;
}
```

- [ ] **Step 3: Add pirate case in processArrival**

```typescript
case 'pirate': {
  const pveMissionId = event.pveMissionId;
  const mission = pveMissionId
    ? await db.select().from(pveMissions).where(eq(pveMissions.id, pveMissionId)).limit(1).then(r => r[0])
    : null;

  const ships = event.ships as Record<string, number>;
  const targetCoords = { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition };

  if (!mission) {
    await this.scheduleReturn(event.id, event.originPlanetId, targetCoords, ships, 0, 0, 0);
    break;
  }

  const params = mission.parameters as { templateId: string };

  // Get player techs
  const research = await db.select().from(userResearch).where(eq(userResearch.userId, event.userId));
  const playerTechs: CombatTechs = {
    weapons: research.find(r => r.researchId === 'weapons')?.level ?? 0,
    shielding: research.find(r => r.researchId === 'shielding')?.level ?? 0,
    armor: research.find(r => r.researchId === 'armor')?.level ?? 0,
  };

  const config = await gameConfigService.getFullConfig();
  const shipStatsMap = buildShipStatsMap(config);
  const cargoCapacity = totalCargoCapacity(ships, shipStatsMap);
  const result = await pirateService.processPirateArrival(
    ships, playerTechs, params.templateId, cargoCapacity,
  );

  // Update fleet event: surviving ships, loot as cargo, bonus ships in metadata
  await db.update(fleetEvents).set({
    ships: result.survivingShips,
    mineraiCargo: String(result.loot.minerai),
    siliciumCargo: String(result.loot.silicium),
    hydrogeneCargo: String(result.loot.hydrogene),
    metadata: Object.keys(result.bonusShips).length > 0
      ? { bonusShips: result.bonusShips }
      : null,
  }).where(eq(fleetEvents.id, event.id));

  await this.scheduleReturn(
    event.id, event.originPlanetId, targetCoords,
    result.survivingShips,
    result.loot.minerai, result.loot.silicium, result.loot.hydrogene,
  );
  await pveService.completeMission(mission.id);

  // Log combat event
  await db.insert(gameEvents).values({
    userId: event.userId,
    planetId: event.originPlanetId,
    type: 'pve_combat_reward',
    payload: {
      outcome: result.outcome,
      loot: result.loot,
      bonusShips: result.bonusShips,
      losses: result.attackerLosses,
    },
  });

  break;
}
```

- [ ] **Step 4: Handle bonus ships in processReturn**

In the `processReturn` method (around line 435, after the existing ship crediting block), add:

```typescript
// Credit PvE bonus ships from metadata
const meta = event.metadata as { bonusShips?: Record<string, number> } | null;
if (meta?.bonusShips) {
  // Re-read current ship counts, then add bonus ships using the same Drizzle ORM pattern
  const currentShips = await this.getOrCreateShips(event.originPlanetId);
  const bonusUpdates: Record<string, number> = {};
  for (const [shipId, count] of Object.entries(meta.bonusShips)) {
    const current = (currentShips[shipId as keyof typeof currentShips] ?? 0) as number;
    bonusUpdates[shipId] = current + count;
  }
  if (Object.keys(bonusUpdates).length > 0) {
    await db.update(planetShips).set(bonusUpdates)
      .where(eq(planetShips.planetId, event.originPlanetId));
  }
}
```

Note: `planetShips` uses camelCase property names in Drizzle (e.g., `planetShips.lightFighter`) which map to snake_case columns (e.g., `light_fighter`). The `.set(bonusUpdates)` approach works because Drizzle handles the mapping — the keys in `bonusUpdates` must be camelCase (matching the Drizzle schema property names), which they already are since ship IDs in the game are camelCase.

- [ ] **Step 5: Add scheduleReturnWithDelay helper**

Add near the existing `scheduleReturn` method (line ~481). Follows the exact same pattern — factory closure, same parameter style, uses `getDriveTechsByEvent`:
```typescript
async scheduleReturnWithDelay(
  fleetEventId: string,
  originPlanetId: string,
  targetCoords: { galaxy: number; system: number; position: number },
  ships: Record<string, number>,
  mineraiCargo: number,
  siliciumCargo: number,
  hydrogeneCargo: number,
  delayMs: number,
) {
  const [originPlanet] = await db
    .select()
    .from(planets)
    .where(eq(planets.id, originPlanetId))
    .limit(1);

  if (!originPlanet) return;

  const config = await gameConfigService.getFullConfig();
  const shipStatsMap = buildShipStatsMap(config);
  const driveTechs = await this.getDriveTechsByEvent(fleetEventId);
  const speed = fleetSpeed(ships, driveTechs, shipStatsMap);
  const origin = { galaxy: originPlanet.galaxy, system: originPlanet.system, position: originPlanet.position };
  const duration = travelTime(targetCoords, origin, speed, universeSpeed);

  const now = new Date();
  const departureTime = new Date(now.getTime() + delayMs);
  const returnTime = new Date(departureTime.getTime() + duration * 1000);

  await db
    .update(fleetEvents)
    .set({
      phase: 'return',
      departureTime,
      arrivalTime: returnTime,
      mineraiCargo: String(mineraiCargo),
      siliciumCargo: String(siliciumCargo),
      hydrogeneCargo: String(hydrogeneCargo),
      ships,
    })
    .where(eq(fleetEvents.id, fleetEventId));

  await fleetReturnQueue.add(
    'return',
    { fleetEventId },
    { delay: delayMs + duration * 1000, jobId: `fleet-return-${fleetEventId}` },
  );
},
```

- [ ] **Step 6: Update createFleetService factory signature**

The `createFleetService` factory (line 70) needs 3 new parameters:
```typescript
export function createFleetService(
  db: Database,
  resourceService: ReturnType<typeof createResourceService>,
  fleetArrivalQueue: Queue,
  fleetReturnQueue: Queue,
  universeSpeed: number,
  messageService: ReturnType<typeof createMessageService> | undefined,
  gameConfigService: GameConfigService,
  // New PvE dependencies:
  pveService?: ReturnType<typeof createPveService>,
  asteroidBeltService?: ReturnType<typeof createAsteroidBeltService>,
  pirateService?: ReturnType<typeof createPirateService>,
)
```

Make them optional (`?`) so existing callers (workers) can be updated incrementally. The mine/pirate cases in processArrival check if the services exist and bail out if not.

- [ ] **Step 7: Update fleet worker files**

In `apps/api/src/workers/fleet-arrival.worker.ts` and `apps/api/src/workers/fleet-return.worker.ts`:
- Import and instantiate `createAsteroidBeltService`, `createPirateService`, `createPveService` (using the same `db` and `gameConfigService` already available in the worker)
- Pass them to `createFleetService`

- [ ] **Step 8: Handle fleet recall for PvE missions**

In the `recallFleet` method, when a mine/pirate fleet is recalled while outbound:
- If `event.pveMissionId` exists, call `pveService.releaseMission(event.pveMissionId)` to put the mission back to 'available' status
- This works for both mine and pirate — the mission becomes available again for the player

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: integrate mine/pirate missions into fleet service"
```

---

### Task 12: PvE tRPC Router

**Files:**
- Create: `apps/api/src/modules/pve/pve.router.ts`
- Modify: `apps/api/src/trpc/app-router.ts`

- [ ] **Step 1: Create PvE router**

Create `apps/api/src/modules/pve/pve.router.ts`:
```typescript
import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createPveService } from './pve.service.js';
import type { createAsteroidBeltService } from './asteroid-belt.service.js';

export function createPveRouter(
  pveService: ReturnType<typeof createPveService>,
  asteroidBeltService: ReturnType<typeof createAsteroidBeltService>,
) {
  return router({
    getMissions: protectedProcedure.query(async ({ ctx }) => {
      const missions = await pveService.getMissions(ctx.userId);
      const centerLevel = await pveService.getMissionCenterLevel(ctx.userId);
      return { missions, centerLevel };
    }),

    getSystemBelts: protectedProcedure
      .input(z.object({
        galaxy: z.number().int().min(1).max(9),
        system: z.number().int().min(1).max(499),
      }))
      .query(async ({ input }) => {
        return asteroidBeltService.getSystemDeposits(input.galaxy, input.system);
      }),
  });
}
```

- [ ] **Step 2: Register PvE router in app-router**

In `apps/api/src/trpc/app-router.ts`:
1. Import and create the PvE services (asteroidBeltService, pirateService, pveService)
2. Create the PvE router
3. Add `pve: pveRouter` to the router object

- [ ] **Step 3: Pass PvE services to fleet service**

The fleet service needs access to `pveService`, `asteroidBeltService`, and `pirateService` for processArrival/Return. Update the fleet service factory function to accept these as parameters.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add PvE tRPC router and register in app router"
```

---

### Task 13: Mission Refresh Worker

**Files:**
- Modify: `apps/api/src/workers/worker.ts`

- [ ] **Step 1: Add mission-refresh cron**

In `apps/api/src/workers/worker.ts`, add a new cron alongside the existing ones:

```typescript
// Mission refresh — every 30 minutes
const missionRefresh = setInterval(async () => {
  try {
    // Get all users who have a Mission Center
    const usersWithCenter = await db.execute(sql`
      SELECT DISTINCT p.user_id
      FROM planet_buildings pb
      JOIN planets p ON p.id = pb.planet_id
      WHERE pb.building_id = 'missionCenter' AND pb.level >= 1
      LIMIT 100
    `);

    for (const row of usersWithCenter.rows) {
      await pveService.refreshPool(row.user_id as string);
    }

    // Regenerate depleted deposits
    await asteroidBeltService.regenerateDepletedDeposits();
  } catch (err) {
    console.error('Mission refresh error:', err);
  }
}, 30 * 60 * 1000);
```

The worker needs PvE service instances. Add at the top of the worker setup (after `db` is created):
```typescript
import { createGameConfigService } from '../modules/admin/game-config.service.js';
import { createAsteroidBeltService } from '../modules/pve/asteroid-belt.service.js';
import { createPirateService } from '../modules/pve/pirate.service.js';
import { createPveService } from '../modules/pve/pve.service.js';

const gameConfigService = createGameConfigService(db);
const asteroidBeltService = createAsteroidBeltService(db);
const pirateService = createPirateService(db, gameConfigService);
const pveService = createPveService(db, asteroidBeltService, pirateService);
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add mission-refresh cron worker (30min interval)"
```

---

## Chunk 4: Frontend

### Task 14: Add Missions route

**Files:**
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Add lazy import and route**

In `apps/web/src/router.tsx`, add:
```typescript
const Missions = lazy(() => import('./pages/Missions.tsx'));
```

And add the route inside the protected layout children:
```typescript
{ path: 'missions', element: <Missions /> },
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add /missions route"
```

---

### Task 15: Missions page

**Files:**
- Create: `apps/web/src/pages/Missions.tsx`

- [ ] **Step 1: Create the Missions page**

Create `apps/web/src/pages/Missions.tsx`. This page should:

1. Call `trpc.pve.getMissions.useQuery()` to fetch the pool
2. Display mission cards in a list:
   - **Mining missions:** show resource type icon, deposit coordinates, estimated quantity, "Send Prospectors" button
   - **Pirate missions:** show tier badge (easy/medium/hard), enemy composition summary, expected rewards, "Attack" button
3. Each "Send" button navigates to `/fleet?mission=mine&galaxy=X&system=Y&position=Z&pveMissionId=ID` (or `mission=pirate`)
4. Show the player's Mission Center level and pool capacity
5. If no Mission Center: show a message explaining the building is required
6. Follow the existing page patterns (use components from `components/ui/`, use `PageSkeleton` for loading)

The page is read-heavy and delegates fleet dispatch to the existing Fleet page via query params. Keep it simple.

- [ ] **Step 2: Add navigation link**

Add a "Missions" link in the sidebar/navigation components (check `components/layout/Sidebar.tsx` and `components/layout/BottomTabBar.tsx` for the pattern).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Missions page with pool display"
```

---

### Task 16: Fleet page PvE support

**Files:**
- Modify: `apps/web/src/pages/Fleet.tsx`

- [ ] **Step 1: Read PvE query params**

The Fleet page should read query params `?mission=mine&galaxy=X&system=Y&position=Z&pveMissionId=ID` and pre-fill the fleet dispatch form accordingly:
- Set mission type
- Set target coordinates
- Store pveMissionId to include in the sendFleet mutation

- [ ] **Step 2: Update position validation to 16**

Change position input max from 15 to 16.

- [ ] **Step 3: Add mine/pirate mission validation**

Add to the mission validation logic:
```typescript
if (mission === 'mine') {
  if (!ships.prospector || ships.prospector === 0) {
    return 'Mining requires at least 1 prospector';
  }
}
```

- [ ] **Step 4: Add mine/pirate to mission buttons**

Add "Mine" and "Pirate" mission type buttons alongside the existing ones (transport, station, spy, attack, colonize, recycle). Only show them if the player has a Mission Center.

- [ ] **Step 5: Include pveMissionId in sendFleet mutation**

When calling the sendFleet mutation, include the pveMissionId from query params if present.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: support mine/pirate missions in fleet dispatch page"
```

---

### Task 17: Galaxy view extension

**Files:**
- Modify: `apps/web/src/pages/Galaxy.tsx`

- [ ] **Step 1: Render 16 positions instead of 15**

Update the galaxy slot rendering to iterate over 16 positions.

- [ ] **Step 2: Belt slot rendering**

For positions 8 and 16, render a special "Asteroid Belt" row/cell instead of a planet slot:
- Show an asteroid icon
- Show belt name ("Ceinture d'astéroïdes")
- If the player has a Mission Center: show a tooltip with active deposit count and resource types (fetch from `trpc.pve.getSystemBelts`)
- No player/alliance info for belt positions

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: render asteroid belts at positions 8 and 16 in galaxy view"
```

---

### Task 18: Movements view — extraction status

**Files:**
- Modify: `apps/web/src/pages/Movements.tsx`

- [ ] **Step 1: Show "Extracting..." for mining fleets**

For fleet movements with `mission === 'mine'` and `phase === 'return'` where the departure time is in the future (extraction delay), show "Extracting..." instead of "Returning".

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: show extraction status in movements view for mining fleets"
```

---

### Task 19: Final integration test + push

- [ ] **Step 1: Build all packages**

```bash
cd /Users/julienaubree/_projet/ogame-clone && pnpm build
```

Fix any TypeScript errors.

- [ ] **Step 2: Run game-engine tests**

```bash
pnpm --filter @ogame-clone/game-engine test -- --run
```

All tests should pass.

- [ ] **Step 3: Manual smoke test checklist**

- Build Mission Center (requires shipyard 3, lab 1)
- Verify mining missions appear in pool at level 1
- Send prospector + cargo to asteroid belt at pos 8
- Verify fleet arrives, extracts, returns with resources
- Upgrade to level 3, verify pirate missions appear
- Send fleet to easy pirate mission
- Verify combat resolves, loot returns
- Check galaxy view shows belts at pos 8 and 16
- Check position 16 is rendered correctly
- Verify cannot colonize positions 8 or 16

- [ ] **Step 4: Final commit and push**

```bash
git add -A && git commit -m "fix: resolve build issues from PvE integration" && git push
```
