# Unified Bonus System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded building/research bonus effects with a configurable `bonus_definitions` table and a `resolveBonus()` engine function.

**Architecture:** New DB table `bonusDefinitions` stores per-source bonus rules (stat, %/level, optional category). A pure `resolveBonus()` function in game-engine computes the combined multiplier. Services pass the multiplier into existing formula functions instead of hardcoded tech levels.

**Tech Stack:** Drizzle ORM (PostgreSQL), Vitest, tRPC + Zod, React (admin panel)

**Balance Note:** The old formulas use hyperbolic curves (`1/(1+level)`) while the new system uses linear (`1 + pct*level`). This is an intentional design change — seed values are starting points and MUST be tuned via the admin panel after migration. The spec acknowledges this.

**Out of scope:** Web frontend display of bonus effects (spec line 141) — will be a separate follow-up task.

---

## Chunk 1: Core Engine + DB Schema

### Task 1: DB Schema — add `bonusDefinitions` table

**Files:**
- Modify: `packages/db/src/schema/game-config.ts`

- [ ] **Step 1: Add `bonusDefinitions` table to schema**

Add after the `buildingPrerequisites` table in `packages/db/src/schema/game-config.ts`:

```typescript
// ── Bonus Definitions ──

export const bonusDefinitions = pgTable('bonus_definitions', {
  id: varchar('id', { length: 128 }).primaryKey(),
  sourceType: varchar('source_type', { length: 16 }).notNull(), // 'building' | 'research'
  sourceId: varchar('source_id', { length: 64 }).notNull(),
  stat: varchar('stat', { length: 64 }).notNull(),
  percentPerLevel: real('percent_per_level').notNull(),
  category: varchar('category', { length: 64 }),
});
```

Do NOT remove `buildTimeReductionFactor` / `reducesTimeForCategory` columns yet — they're still referenced by live code. They'll be removed in Task 13 after all code references are eliminated.

- [ ] **Step 2: Generate and apply Drizzle migration**

```bash
cd packages/db && pnpm drizzle-kit generate && pnpm drizzle-kit push
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/game-config.ts packages/db/drizzle/
git commit -m "feat(db): add bonusDefinitions table"
```

---

### Task 2: Seed bonus definitions

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Add bonus definitions seed data**

Import `bonusDefinitions` from the schema. Add after building definitions section:

```typescript
await db.insert(bonusDefinitions).values([
  { id: 'robotics__building_time', sourceType: 'building', sourceId: 'robotics', stat: 'building_time', percentPerLevel: -15, category: null },
  { id: 'researchLab__research_time', sourceType: 'building', sourceId: 'researchLab', stat: 'research_time', percentPerLevel: -15, category: null },
  { id: 'shipyard__ship_build_time__build_industrial', sourceType: 'building', sourceId: 'shipyard', stat: 'ship_build_time', percentPerLevel: -15, category: 'build_industrial' },
  { id: 'arsenal__defense_build_time', sourceType: 'building', sourceId: 'arsenal', stat: 'defense_build_time', percentPerLevel: -15, category: null },
  { id: 'commandCenter__ship_build_time__build_military', sourceType: 'building', sourceId: 'commandCenter', stat: 'ship_build_time', percentPerLevel: -15, category: 'build_military' },
  { id: 'weapons__weapons', sourceType: 'research', sourceId: 'weapons', stat: 'weapons', percentPerLevel: 10, category: null },
  { id: 'shielding__shielding', sourceType: 'research', sourceId: 'shielding', stat: 'shielding', percentPerLevel: 10, category: null },
  { id: 'armor__armor', sourceType: 'research', sourceId: 'armor', stat: 'armor', percentPerLevel: 10, category: null },
  { id: 'combustion__ship_speed__combustion', sourceType: 'research', sourceId: 'combustion', stat: 'ship_speed', percentPerLevel: 10, category: 'combustion' },
  { id: 'impulse__ship_speed__impulse', sourceType: 'research', sourceId: 'impulse', stat: 'ship_speed', percentPerLevel: 20, category: 'impulse' },
  { id: 'hyperspaceDrive__ship_speed__hyperspaceDrive', sourceType: 'research', sourceId: 'hyperspaceDrive', stat: 'ship_speed', percentPerLevel: 30, category: 'hyperspaceDrive' },
  { id: 'rockFracturing__mining_duration', sourceType: 'research', sourceId: 'rockFracturing', stat: 'mining_duration', percentPerLevel: -10, category: null },
  { id: 'computerTech__fleet_count', sourceType: 'research', sourceId: 'computerTech', stat: 'fleet_count', percentPerLevel: 100, category: null },
  { id: 'espionageTech__spy_range', sourceType: 'research', sourceId: 'espionageTech', stat: 'spy_range', percentPerLevel: 100, category: null },
]);
```

Note: `fleet_count` and `spy_range` are seeded for future use. No callsites use them yet — the spy handler uses raw espionageTech levels directly for `calculateSpyReport()` which is unrelated to the bonus system.

- [ ] **Step 2: Run seed**

```bash
cd packages/db && pnpm seed
```

Verify: `SELECT * FROM bonus_definitions ORDER BY id;` — 14 rows.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(db): seed 14 bonus definitions"
```

---

### Task 3: `resolveBonus()` game-engine function (TDD)

**Files:**
- Create: `packages/game-engine/src/formulas/bonus.ts`
- Create: `packages/game-engine/src/formulas/bonus.test.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/game-engine/src/formulas/bonus.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveBonus, type BonusDefinition } from './bonus.js';

const bonusDefs: BonusDefinition[] = [
  { sourceType: 'building', sourceId: 'robotics', stat: 'building_time', percentPerLevel: -15, category: null },
  { sourceType: 'building', sourceId: 'researchLab', stat: 'research_time', percentPerLevel: -15, category: null },
  { sourceType: 'research', sourceId: 'combustion', stat: 'ship_speed', percentPerLevel: 10, category: 'combustion' },
  { sourceType: 'research', sourceId: 'impulse', stat: 'ship_speed', percentPerLevel: 20, category: 'impulse' },
  { sourceType: 'research', sourceId: 'weapons', stat: 'weapons', percentPerLevel: 10, category: null },
  { sourceType: 'research', sourceId: 'computerTech', stat: 'fleet_count', percentPerLevel: 100, category: null },
];

describe('resolveBonus', () => {
  it('returns 1.0 when no bonus matches', () => {
    expect(resolveBonus('cargo_capacity', null, {}, bonusDefs)).toBe(1);
  });

  it('returns 1.0 when source level is 0', () => {
    expect(resolveBonus('building_time', null, { robotics: 0 }, bonusDefs)).toBe(1);
  });

  it('computes single negative bonus (robotics level 3)', () => {
    const result = resolveBonus('building_time', null, { robotics: 3 }, bonusDefs);
    expect(result).toBeCloseTo(0.55, 10);
  });

  it('clamps modifier to 0.01 minimum per source', () => {
    const result = resolveBonus('building_time', null, { robotics: 10 }, bonusDefs);
    expect(result).toBeCloseTo(0.01, 10);
  });

  it('computes positive bonus (weapons level 5)', () => {
    const result = resolveBonus('weapons', null, { weapons: 5 }, bonusDefs);
    expect(result).toBeCloseTo(1.5, 10);
  });

  it('matches category filter (combustion speed)', () => {
    const result = resolveBonus('ship_speed', 'combustion', { combustion: 5 }, bonusDefs);
    expect(result).toBeCloseTo(1.5, 10);
  });

  it('does not match wrong category', () => {
    const result = resolveBonus('ship_speed', 'combustion', { impulse: 5 }, bonusDefs);
    expect(result).toBe(1);
  });

  it('null category on bonus matches any category query', () => {
    const result = resolveBonus('weapons', 'someCategory', { weapons: 5 }, bonusDefs);
    expect(result).toBeCloseTo(1.5, 10);
  });

  it('multiplies multiple matching bonuses', () => {
    const defs: BonusDefinition[] = [
      { sourceType: 'building', sourceId: 'a', stat: 'building_time', percentPerLevel: -10, category: null },
      { sourceType: 'building', sourceId: 'b', stat: 'building_time', percentPerLevel: -20, category: null },
    ];
    const result = resolveBonus('building_time', null, { a: 2, b: 1 }, defs);
    expect(result).toBeCloseTo(0.64, 10);
  });

  it('fleet_count +100%/level at level 5 gives 6.0', () => {
    const result = resolveBonus('fleet_count', null, { computerTech: 5 }, bonusDefs);
    expect(result).toBeCloseTo(6, 10);
  });

  it('clamps combined result to 0.01 minimum', () => {
    const defs: BonusDefinition[] = [
      { sourceType: 'building', sourceId: 'a', stat: 'building_time', percentPerLevel: -80, category: null },
      { sourceType: 'building', sourceId: 'b', stat: 'building_time', percentPerLevel: -80, category: null },
    ];
    const result = resolveBonus('building_time', null, { a: 1, b: 1 }, defs);
    expect(result).toBeCloseTo(0.04, 10);
  });

  it('ignores sources not present in userLevels', () => {
    const result = resolveBonus('building_time', null, {}, bonusDefs);
    expect(result).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/game-engine && pnpm vitest run src/formulas/bonus.test.ts
```

Expected: FAIL — `Cannot find module './bonus.js'`

- [ ] **Step 3: Implement `resolveBonus()`**

Create `packages/game-engine/src/formulas/bonus.ts`:

```typescript
export interface BonusDefinition {
  sourceType: 'building' | 'research';
  sourceId: string;
  stat: string;
  percentPerLevel: number;
  category: string | null;
}

/**
 * Resolves the combined multiplier for a given stat + optional category.
 *
 * Matching: bonus.stat === stat AND (bonus.category is null OR bonus.category === category).
 * Per-source: max(0.01, 1 + percentPerLevel / 100 * sourceLevel).
 * Combined: max(0.01, product of all matching modifiers).
 * Returns 1.0 if no bonus matches or all source levels are 0.
 */
export function resolveBonus(
  stat: string,
  category: string | null,
  userLevels: Record<string, number>,
  bonusDefs: BonusDefinition[],
): number {
  let result = 1;
  let hasMatch = false;

  for (const def of bonusDefs) {
    if (def.stat !== stat) continue;
    if (def.category !== null && def.category !== category) continue;

    const level = userLevels[def.sourceId] ?? 0;
    if (level === 0) continue;

    hasMatch = true;
    const modifier = Math.max(0.01, 1 + (def.percentPerLevel / 100) * level);
    result *= modifier;
  }

  if (!hasMatch) return 1;
  return Math.max(0.01, result);
}
```

- [ ] **Step 4: Export from game-engine index**

Add to `packages/game-engine/src/index.ts`:

```typescript
export * from './formulas/bonus.js';
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/game-engine && pnpm vitest run src/formulas/bonus.test.ts
```

Expected: All 11 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/bonus.ts packages/game-engine/src/formulas/bonus.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add resolveBonus() with full test coverage"
```

---

## Chunk 2: GameConfig + Admin API Integration

### Task 4: Load bonus definitions in GameConfig + CRUD

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.service.ts`

- [ ] **Step 1: Add `BonusConfig` interface and update `GameConfig`**

Add interface:

```typescript
export interface BonusConfig {
  id: string;
  sourceType: string;
  sourceId: string;
  stat: string;
  percentPerLevel: number;
  category: string | null;
}
```

Add to `GameConfig` interface:

```typescript
  bonuses: BonusConfig[];
```

- [ ] **Step 2: Load bonus definitions in `getFullConfig()`**

Add `bonusDefinitions` to the import from `@ogame-clone/db`.

Add `bonusRows` to the `Promise.all` parallel load:

```typescript
  db.select().from(bonusDefinitions),
```

Add assembly after existing data:

```typescript
    const bonuses: BonusConfig[] = bonusRows.map(b => ({
      id: b.id,
      sourceType: b.sourceType,
      sourceId: b.sourceId,
      stat: b.stat,
      percentPerLevel: b.percentPerLevel,
      category: b.category,
    }));
```

Add `bonuses` to the `cache` assignment object.

- [ ] **Step 3: Add CRUD methods for bonuses**

Add to the service return object:

```typescript
    async createBonus(data: {
      id: string;
      sourceType: string;
      sourceId: string;
      stat: string;
      percentPerLevel: number;
      category?: string | null;
    }) {
      await db.insert(bonusDefinitions).values({
        id: data.id,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        stat: data.stat,
        percentPerLevel: data.percentPerLevel,
        category: data.category ?? null,
      });
      invalidateCache();
    },

    async updateBonus(id: string, data: Partial<{
      stat: string;
      percentPerLevel: number;
      category: string | null;
    }>) {
      await db.update(bonusDefinitions).set(data).where(eq(bonusDefinitions.id, id));
      invalidateCache();
    },

    async deleteBonus(id: string) {
      await db.delete(bonusDefinitions).where(eq(bonusDefinitions.id, id));
      invalidateCache();
    },
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/admin/game-config.service.ts
git commit -m "feat(api): load bonusDefinitions in GameConfig, add bonus CRUD methods"
```

---

### Task 5: Admin tRPC endpoints for bonuses

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.router.ts`

- [ ] **Step 1: Add bonus CRUD endpoints to admin router**

```typescript
    createBonus: adminProcedure
      .input(z.object({
        id: z.string().min(1),
        sourceType: z.enum(['building', 'research']),
        sourceId: z.string().min(1),
        stat: z.string().min(1),
        percentPerLevel: z.number(),
        category: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        await gameConfigService.createBonus(input);
        return { success: true };
      }),

    updateBonus: adminProcedure
      .input(z.object({
        id: z.string(),
        data: z.object({
          stat: z.string().optional(),
          percentPerLevel: z.number().optional(),
          category: z.string().nullable().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        await gameConfigService.updateBonus(input.id, input.data);
        return { success: true };
      }),

    deleteBonus: adminProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await gameConfigService.deleteBonus(input.id);
        return { success: true };
      }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/admin/game-config.router.ts
git commit -m "feat(api): add bonus CRUD tRPC endpoints"
```

---

## Chunk 3: Formula Migrations

### Task 6: Migrate `buildingTime()` to use bonus multiplier

**Files:**
- Modify: `packages/game-engine/src/formulas/building-cost.ts`
- Modify: `packages/game-engine/src/formulas/building-cost.test.ts`
- Modify: `apps/api/src/modules/building/building.service.ts`

- [ ] **Step 1: Update tests**

In `packages/game-engine/src/formulas/building-cost.test.ts`, update the `buildingTime` tests. The third parameter changes from `roboticsLevel` to `bonusMultiplier`:

```typescript
describe('buildingTime', () => {
  it('no bonus (multiplier 1.0) applies phaseMultiplier', () => {
    const time = buildingTime(mineraiMineDef, 1, 1.0);
    expect(time).toBe(15); // 45 * 0.35 * 1.0 = 15.75 → 15
  });

  it('bonus multiplier 0.55 applies phaseMultiplier', () => {
    const time = buildingTime(mineraiMineDef, 1, 0.55);
    expect(time).toBe(8); // 45 * 0.35 * 0.55 = 8.66 → 8
  });

  it('level 10 no bonus', () => {
    const time = buildingTime(mineraiMineDef, 10, 1.0);
    expect(time).toBe(1729);
  });

  it('robotics def level 3 with multiplier 0.55', () => {
    const time = buildingTime(roboticsDef, 3, 0.55);
    expect(time).toBe(72); // 60 * 4 * 0.55 * 0.55 = 72.6 → 72
  });

  it('minimum time is 1 second', () => {
    const time = buildingTime(mineraiMineDef, 1, 0.001);
    expect(time).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/game-engine && pnpm vitest run src/formulas/building-cost.test.ts
```

- [ ] **Step 3: Update `buildingTime()` implementation**

In `packages/game-engine/src/formulas/building-cost.ts`, replace:

```typescript
export function buildingTime(def: BuildingCostDef, level: number, bonusMultiplier: number): number {
  const seconds = Math.floor(def.baseTime * Math.pow(def.costFactor, level - 1) * bonusMultiplier * getPhaseMultiplier(level));
  return Math.max(1, seconds);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/game-engine && pnpm vitest run src/formulas/building-cost.test.ts
```

- [ ] **Step 5: Update `building.service.ts` callers**

Add `resolveBonus` to import from `@ogame-clone/game-engine`.

In `listBuildings()` (line 52), replace:
```typescript
          const time = buildingTime(def, nextLevel, buildingLevels['robotics'] ?? 0);
```
with:
```typescript
          const bonusMultiplier = resolveBonus('building_time', null, buildingLevels, config.bonuses);
          const time = buildingTime(def, nextLevel, bonusMultiplier);
```

In `startUpgrade()` (line 116), same replacement:
```typescript
      const bonusMultiplier = resolveBonus('building_time', null, buildingLevels, config.bonuses);
      const time = buildingTime(def, nextLevel, bonusMultiplier);
```

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/building-cost.ts packages/game-engine/src/formulas/building-cost.test.ts apps/api/src/modules/building/building.service.ts
git commit -m "feat: migrate buildingTime() to use bonus multiplier"
```

---

### Task 7: Migrate `researchTime()` to use bonus multiplier

**Files:**
- Modify: `packages/game-engine/src/formulas/research-cost.ts`
- Modify: `apps/api/src/modules/research/research.service.ts`

- [ ] **Step 1: Update `researchTime()` implementation**

In `packages/game-engine/src/formulas/research-cost.ts`, replace:

```typescript
export function researchTime(def: ResearchCostDef, level: number, bonusMultiplier: number): number {
  const cost = researchCost(def, level);
  const seconds = Math.floor(((cost.minerai + cost.silicium) / 1000) * 3600 * bonusMultiplier * getPhaseMultiplier(level));
  return Math.max(1, seconds);
}
```

Note: old formula was `/ (1000 * (1 + labLevel))` which equals `/ 1000 * 1/(1+labLevel)`. The new formula is `/ 1000 * bonusMultiplier`. The `bonusMultiplier` from `resolveBonus` replaces the `1/(1+labLevel)` part.

- [ ] **Step 2: Update `research.service.ts` callers**

Add `resolveBonus` to import from `@ogame-clone/game-engine`.

In `listResearch()` (lines 53-54), replace:
```typescript
          const researchLabLevel = buildingLevels['researchLab'] ?? 0;
          const time = researchTime(def, nextLevel, researchLabLevel);
```
with:
```typescript
          const bonusMultiplier = resolveBonus('research_time', null, buildingLevels, config.bonuses);
          const time = researchTime(def, nextLevel, bonusMultiplier);
```

In `startResearch()` (lines 113-114), same replacement.

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/formulas/research-cost.ts apps/api/src/modules/research/research.service.ts
git commit -m "feat: migrate researchTime() to use bonus multiplier"
```

---

### Task 8: Migrate `shipTime()` / `defenseTime()` to use bonus multiplier

**Files:**
- Modify: `packages/game-engine/src/formulas/shipyard-cost.ts`
- Modify: `apps/api/src/modules/shipyard/shipyard.service.ts`

- [ ] **Step 1: Update `shipTime()` and `defenseTime()`**

In `packages/game-engine/src/formulas/shipyard-cost.ts`, replace both functions:

```typescript
export function shipTime(def: UnitCostDef, bonusMultiplier: number): number {
  const seconds = Math.floor(((def.cost.minerai + def.cost.silicium) / 2500) * 3600 * bonusMultiplier);
  return Math.max(1, seconds);
}

export function defenseTime(def: UnitCostDef, bonusMultiplier: number): number {
  const seconds = Math.floor(((def.cost.minerai + def.cost.silicium) / 2500) * 3600 * bonusMultiplier);
  return Math.max(1, seconds);
}
```

- [ ] **Step 2: Update `shipyard.service.ts`**

Add imports:
```typescript
import { resolveBonus } from '@ogame-clone/game-engine';
import type { ShipConfig, GameConfig } from '../admin/game-config.service.js';
```

Add helper at top of file (after imports):

```typescript
function getShipBuildCategory(def: ShipConfig, config: GameConfig): string | null {
  const firstBuildingPrereq = def.prerequisites?.buildings?.[0]?.buildingId;
  if (!firstBuildingPrereq) return null;
  const bonus = config.bonuses.find(
    b => b.stat === 'ship_build_time' && b.sourceId === firstBuildingPrereq
  );
  return bonus?.category ?? null;
}
```

This derives the build category from the ship's first building prerequisite. Ships built at `shipyard` get `build_industrial`, ships built at `commandCenter` get `build_military`.

**Replace all 6 callsites** that use the old `productionBuildingId` / `reductionFactor` / `buildingLevel` pattern:

For ships (in `listShips`, `startBuild`, `completeUnit`, `activateNextBatch`):
```typescript
const buildCategory = getShipBuildCategory(shipDef, config);
const bonusMultiplier = resolveBonus('ship_build_time', buildCategory, buildingLevels, config.bonuses);
const time = shipTime(def, bonusMultiplier);
```

For defenses (in `listDefenses`, `startBuild`, `completeUnit`, `activateNextBatch`):
```typescript
const bonusMultiplier = resolveBonus('defense_build_time', null, buildingLevels, config.bonuses);
const time = defenseTime(def, bonusMultiplier);
```

In `startBuild()`, use conditional:
```typescript
      let unitTime: number;
      if (type === 'ship') {
        const buildCategory = getShipBuildCategory(config.ships[itemId], config);
        const bonusMultiplier = resolveBonus('ship_build_time', buildCategory, buildingLevels, config.bonuses);
        unitTime = shipTime(def, bonusMultiplier);
      } else {
        const bonusMultiplier = resolveBonus('defense_build_time', null, buildingLevels, config.bonuses);
        unitTime = defenseTime(def, bonusMultiplier);
      }
```

Same pattern for `completeUnit()` and `activateNextBatch()`.

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/formulas/shipyard-cost.ts apps/api/src/modules/shipyard/shipyard.service.ts
git commit -m "feat: migrate shipTime/defenseTime to use bonus multiplier"
```

---

### Task 9: Migrate fleet speed to use bonus multiplier

**Files:**
- Modify: `packages/game-engine/src/formulas/fleet.ts`
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Update `shipSpeed()` and `fleetSpeed()`**

In `packages/game-engine/src/formulas/fleet.ts`:

Remove `DRIVE_BONUS` constant and `DriveTechs` interface.

Replace `shipSpeed()` and `fleetSpeed()`:

```typescript
export function shipSpeed(stats: ShipStats, speedMultiplier: number): number {
  return Math.floor(stats.baseSpeed * speedMultiplier);
}

export function fleetSpeed(
  ships: Record<string, number>,
  shipStatsMap: Record<string, ShipStats>,
  speedMultipliers: Record<string, number>,
): number {
  let minSpeed = Infinity;
  for (const [shipId, count] of Object.entries(ships)) {
    if (count > 0) {
      const stats = shipStatsMap[shipId];
      if (!stats) continue;
      const multiplier = speedMultipliers[shipId] ?? 1;
      const speed = shipSpeed(stats, multiplier);
      if (speed < minSpeed) minSpeed = speed;
    }
  }
  return minSpeed === Infinity ? 0 : minSpeed;
}
```

The `speedMultipliers` is `Record<shipId, number>` — precomputed from `resolveBonus('ship_speed', driveType, researchLevels, bonusDefs)` per ship.

- [ ] **Step 2: Update `fleet.service.ts`**

Add `resolveBonus` to import from `@ogame-clone/game-engine`.

Add a `getResearchLevels()` helper method:

```typescript
    async getResearchLevels(userId: string): Promise<Record<string, number>> {
      const [research] = await db
        .select()
        .from(userResearch)
        .where(eq(userResearch.userId, userId))
        .limit(1);
      if (!research) return {};
      const levels: Record<string, number> = {};
      for (const [key, value] of Object.entries(research)) {
        if (key !== 'userId' && typeof value === 'number') {
          levels[key] = value;
        }
      }
      return levels;
    },
```

Add a helper to build per-ship speed multipliers:

```typescript
    buildSpeedMultipliers(
      ships: Record<string, number>,
      shipStatsMap: Record<string, ShipStats>,
      researchLevels: Record<string, number>,
      bonusDefs: BonusConfig[],
    ): Record<string, number> {
      const multipliers: Record<string, number> = {};
      for (const shipId of Object.keys(ships)) {
        const stats = shipStatsMap[shipId];
        if (stats) {
          multipliers[shipId] = resolveBonus('ship_speed', stats.driveType, researchLevels, bonusDefs);
        }
      }
      return multipliers;
    },
```

**Update `sendFleet()`** (lines 80-81). Replace:
```typescript
      const driveTechs = await this.getDriveTechs(userId);
      const speed = fleetSpeed(input.ships, driveTechs, shipStatsMap);
```
with:
```typescript
      const researchLevels = await this.getResearchLevels(userId);
      const speedMultipliers = this.buildSpeedMultipliers(input.ships, shipStatsMap, researchLevels, config.bonuses);
      const speed = fleetSpeed(input.ships, shipStatsMap, speedMultipliers);
```

**Update `scheduleReturn()`** (lines 547-549). Replace:
```typescript
      const driveTechs = await this.getDriveTechsByEvent(fleetEventId);
      const speed = fleetSpeed(ships, driveTechs, shipStatsMap);
```
with:
```typescript
      const [event] = await db.select().from(fleetEvents).where(eq(fleetEvents.id, fleetEventId)).limit(1);
      const researchLevels = event ? await this.getResearchLevels(event.userId) : {};
      const speedMultipliers = this.buildSpeedMultipliers(ships, shipStatsMap, researchLevels, config.bonuses);
      const speed = fleetSpeed(ships, shipStatsMap, speedMultipliers);
```

**Remove** `getDriveTechs()` and `getDriveTechsByEvent()` methods — no longer needed.

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/formulas/fleet.ts apps/api/src/modules/fleet/fleet.service.ts
git commit -m "feat: migrate fleet speed to use bonus multiplier"
```

---

### Task 10: Migrate combat techs to use bonus multiplier

**Files:**
- Modify: `packages/game-engine/src/formulas/combat.ts`
- Modify: `packages/game-engine/src/formulas/combat.test.ts`
- Modify: `apps/api/src/modules/fleet/fleet.types.ts`
- Modify: `apps/api/src/modules/fleet/handlers/attack.handler.ts`
- Modify: `apps/api/src/modules/fleet/handlers/pirate.handler.ts`
- Modify: `apps/api/src/modules/pve/pirate.service.ts`

- [ ] **Step 1: Update `combat.ts` signatures**

Replace `CombatTechs` interface with `CombatMultipliers`:

```typescript
export interface CombatMultipliers {
  weapons: number;
  shielding: number;
  armor: number;
}
```

Update `createUnits()`:

```typescript
function createUnits(
  fleet: Record<string, number>,
  multipliers: CombatMultipliers,
  combatStats: Record<string, UnitCombatStats>,
): CombatUnit[] {
  const units: CombatUnit[] = [];
  for (const [type, count] of Object.entries(fleet)) {
    const base = combatStats[type];
    if (!base) continue;
    for (let i = 0; i < count; i++) {
      const weapons = base.weapons * multipliers.weapons;
      const shield = base.shield * multipliers.shielding;
      const armor = base.armor * multipliers.armor;
      units.push({ type, weapons, shield, maxShield: shield, armor, maxArmor: armor, destroyed: false });
    }
  }
  return units;
}
```

Update `simulateCombat()` signature:
```typescript
export function simulateCombat(
  attackerFleet: Record<string, number>,
  defenderFleet: Record<string, number>,
  attackerMultipliers: CombatMultipliers,
  defenderMultipliers: CombatMultipliers,
  combatStats: Record<string, UnitCombatStats>,
  ...rest
)
```

Remove old `CombatTechs` export.

- [ ] **Step 2: Update `combat.test.ts`**

Replace `zeroTechs` with:
```typescript
const unitMultipliers = { weapons: 1, shielding: 1, armor: 1 };
```

Replace `highWeaponsTech` with:
```typescript
// weapons tech 20 with +10%/level: 1 + 0.1*20 = 3.0
const highWeaponsMultiplier = { weapons: 3, shielding: 1, armor: 1 };
```

Update all `simulateCombat` calls to use `unitMultipliers` instead of `zeroTechs`, and `highWeaponsMultiplier` instead of `highWeaponsTech`.

- [ ] **Step 3: Update `fleet.types.ts`**

In `apps/api/src/modules/fleet/fleet.types.ts`:

Replace the import of `CombatTechs` with `CombatMultipliers`:
```typescript
import type { CombatMultipliers, ShipStats } from '@ogame-clone/game-engine';
```

Replace the `getCombatTechs()` helper with `getCombatMultipliers()`:

```typescript
export async function getCombatMultipliers(
  db: Database,
  userId: string,
  bonusDefs: import('../../admin/game-config.service.js').BonusConfig[],
): Promise<CombatMultipliers> {
  const [research] = await db
    .select({
      weapons: userResearch.weapons,
      shielding: userResearch.shielding,
      armor: userResearch.armor,
    })
    .from(userResearch)
    .where(eq(userResearch.userId, userId))
    .limit(1);

  const levels: Record<string, number> = {
    weapons: research?.weapons ?? 0,
    shielding: research?.shielding ?? 0,
    armor: research?.armor ?? 0,
  };

  const { resolveBonus } = await import('@ogame-clone/game-engine');
  return {
    weapons: resolveBonus('weapons', null, levels, bonusDefs),
    shielding: resolveBonus('shielding', null, levels, bonusDefs),
    armor: resolveBonus('armor', null, levels, bonusDefs),
  };
}
```

Actually, to avoid dynamic import, add `resolveBonus` as a parameter or import it statically at the top. Better approach — import `resolveBonus` at the top of `fleet.types.ts`:

```typescript
import { resolveBonus } from '@ogame-clone/game-engine';
import type { CombatMultipliers, ShipStats } from '@ogame-clone/game-engine';
```

Then the function becomes:

```typescript
export async function getCombatMultipliers(
  db: Database,
  userId: string,
  bonusDefs: { sourceType: string; sourceId: string; stat: string; percentPerLevel: number; category: string | null }[],
): Promise<CombatMultipliers> {
  const [research] = await db
    .select({
      weapons: userResearch.weapons,
      shielding: userResearch.shielding,
      armor: userResearch.armor,
    })
    .from(userResearch)
    .where(eq(userResearch.userId, userId))
    .limit(1);

  const levels: Record<string, number> = {
    weapons: research?.weapons ?? 0,
    shielding: research?.shielding ?? 0,
    armor: research?.armor ?? 0,
  };

  return {
    weapons: resolveBonus('weapons', null, levels, bonusDefs),
    shielding: resolveBonus('shielding', null, levels, bonusDefs),
    armor: resolveBonus('armor', null, levels, bonusDefs),
  };
}
```

- [ ] **Step 4: Update `attack.handler.ts`**

Replace import of `getCombatTechs` with `getCombatMultipliers`.

Replace line 94-95:
```typescript
    const attackerTechs = await getCombatTechs(ctx.db, fleetEvent.userId);
    const defenderTechs = await getCombatTechs(ctx.db, targetPlanet.userId);
```
with:
```typescript
    const attackerMultipliers = await getCombatMultipliers(ctx.db, fleetEvent.userId, config.bonuses);
    const defenderMultipliers = await getCombatMultipliers(ctx.db, targetPlanet.userId, config.bonuses);
```

Update `simulateCombat` call (line 112-116):
```typescript
      const result = simulateCombat(
        ships, defenderCombined, attackerMultipliers, defenderMultipliers,
        combatStatsMap, config.rapidFire,
        shipIdSet, shipCostsMap, defenseIdSet, debrisRatio,
      );
```

- [ ] **Step 5: Update `pirate.handler.ts`**

Replace import of `getCombatTechs` with `getCombatMultipliers`.

Replace line 27:
```typescript
    const playerTechs = await getCombatTechs(ctx.db, fleetEvent.userId);
```
with:
```typescript
    const playerMultipliers = await getCombatMultipliers(ctx.db, fleetEvent.userId, config.bonuses);
```

Update the call to `processPirateArrival` (line 32-33):
```typescript
    const result = await ctx.pirateService.processPirateArrival(
      ships, playerMultipliers, params.templateId, preCargoCapacity,
    );
```

- [ ] **Step 6: Update `pirate.service.ts`**

Change the `processPirateArrival` method signature to accept `CombatMultipliers` instead of `CombatTechs`:

```typescript
import { simulateCombat, resolveBonus, type CombatMultipliers, type UnitCombatStats } from '@ogame-clone/game-engine';
```

```typescript
    async processPirateArrival(
      playerShips: Record<string, number>,
      playerMultipliers: CombatMultipliers,
      templateId: string,
      fleetCargoCapacity: number,
    ): Promise<PirateArrivalResult> {
```

For pirate techs, convert the template's raw tech levels to multipliers using `resolveBonus`:

```typescript
      const pirateTechLevels = template.techs as { weapons: number; shielding: number; armor: number };
      const config = await gameConfigService.getFullConfig();
      const pirateMultipliers: CombatMultipliers = {
        weapons: resolveBonus('weapons', null, { weapons: pirateTechLevels.weapons }, config.bonuses),
        shielding: resolveBonus('shielding', null, { shielding: pirateTechLevels.shielding }, config.bonuses),
        armor: resolveBonus('armor', null, { armor: pirateTechLevels.armor }, config.bonuses),
      };
```

Update the `simulateCombat` call (line 74):
```typescript
      const result = simulateCombat(
        playerShips, pirateShips, playerMultipliers, pirateMultipliers,
        combatStats, rapidFireMap, shipIds, shipCosts, new Set(),
      );
```

- [ ] **Step 7: Commit**

```bash
git add packages/game-engine/src/formulas/combat.ts packages/game-engine/src/formulas/combat.test.ts apps/api/src/modules/fleet/fleet.types.ts apps/api/src/modules/fleet/handlers/attack.handler.ts apps/api/src/modules/fleet/handlers/pirate.handler.ts apps/api/src/modules/pve/pirate.service.ts
git commit -m "feat: migrate combat techs to use resolveBonus multipliers"
```

---

### Task 11: Migrate mining duration to use bonus multiplier

**Files:**
- Modify: `packages/game-engine/src/formulas/pve.ts`
- Modify: `apps/api/src/modules/fleet/handlers/mine.handler.ts`

- [ ] **Step 1: Update `miningDuration()`**

In `packages/game-engine/src/formulas/pve.ts`, replace:

```typescript
/**
 * Mining duration in minutes at the belt.
 * @param bonusMultiplier - result of resolveBonus('mining_duration', null, ...)
 */
export function miningDuration(centerLevel: number, bonusMultiplier: number): number {
  return Math.max(5, 16 - centerLevel) * Math.max(0.01, bonusMultiplier);
}
```

Remove the deprecated `extractionDuration` function.

- [ ] **Step 2: Update `mine.handler.ts`**

Add `resolveBonus` to imports from `@ogame-clone/game-engine`.

In `processProspectDone()`, replace:
```typescript
      const fracturingLevel = research?.rockFracturing ?? 0;
      const mineMins = miningDuration(centerLevel, fracturingLevel);
```
with:
```typescript
      const researchLevels: Record<string, number> = {};
      if (research) {
        for (const [key, value] of Object.entries(research)) {
          if (key !== 'userId' && typeof value === 'number') researchLevels[key] = value;
        }
      }
      const config = await ctx.gameConfigService.getFullConfig();
      const bonusMultiplier = resolveBonus('mining_duration', null, researchLevels, config.bonuses);
      const mineMins = miningDuration(centerLevel, bonusMultiplier);
```

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/formulas/pve.ts apps/api/src/modules/fleet/handlers/mine.handler.ts
git commit -m "feat: migrate miningDuration to use bonus multiplier"
```

---

## Chunk 4: Admin UI + Cleanup

### Task 12: Admin panel — bonus editor on Buildings page

**Files:**
- Modify: `apps/admin/src/pages/Buildings.tsx`

- [ ] **Step 1: Add bonus section to each building row**

Add a stat options constant:
```typescript
const STAT_OPTIONS = [
  { value: 'building_time', label: 'Temps construction' },
  { value: 'research_time', label: 'Temps recherche' },
  { value: 'ship_build_time', label: 'Temps construction vaisseau' },
  { value: 'defense_build_time', label: 'Temps construction défense' },
  { value: 'ship_speed', label: 'Vitesse vaisseau' },
  { value: 'weapons', label: 'Armes' },
  { value: 'shielding', label: 'Boucliers' },
  { value: 'armor', label: 'Blindage' },
  { value: 'mining_duration', label: 'Durée minage' },
  { value: 'cargo_capacity', label: 'Capacité cargo' },
  { value: 'fuel_consumption', label: 'Consommation carburant' },
  { value: 'resource_production', label: 'Production ressources' },
  { value: 'fleet_count', label: 'Nombre de flottes' },
  { value: 'spy_range', label: 'Portée espionnage' },
];
```

In the "Réduction temps" column, replace the display of `buildTimeReductionFactor` / `reducesTimeForCategory` with a display of bonuses from `data.bonuses`:

```tsx
const buildingBonuses = data.bonuses?.filter(
  b => b.sourceType === 'building' && b.sourceId === building.id
) ?? [];
```

Show a compact inline list of bonuses (stat, %/level, category). Add an edit button that opens a small inline form for adding/editing/deleting bonuses.

Wire up `trpc.gameConfig.admin.createBonus`, `updateBonus`, `deleteBonus` mutations.

Auto-generate bonus ID: `{buildingId}__{stat}` or `{buildingId}__{stat}__{category}`.

- [ ] **Step 2: Remove deprecated fields from edit/create forms**

Remove `buildTimeReductionFactor` and `reducesTimeForCategory` from:
- `getFields()` — remove the two field entries
- Edit modal `values` and `onSave`
- Create modal `values` and `onSave`

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/pages/Buildings.tsx
git commit -m "feat(admin): add bonus editor to buildings page, remove deprecated fields"
```

---

### Task 13: Admin panel — bonus editor on Research page

**Files:**
- Modify: `apps/admin/src/pages/Research.tsx`

- [ ] **Step 1: Add bonus section**

Same pattern as Task 12 but for research:

```tsx
const researchBonuses = data.bonuses?.filter(
  b => b.sourceType === 'research' && b.sourceId === research.id
) ?? [];
```

Add inline bonus table with create/delete per research row.

Auto-generated ID: `{researchId}__{stat}` or `{researchId}__{stat}__{category}`.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/pages/Research.tsx
git commit -m "feat(admin): add bonus editor to research page"
```

---

### Task 14: Remove deprecated columns + cleanup

**Files:**
- Modify: `packages/db/src/schema/game-config.ts`
- Modify: `apps/api/src/modules/admin/game-config.service.ts`
- Modify: `apps/api/src/modules/admin/game-config.router.ts`

Now that all code references to `buildTimeReductionFactor` and `reducesTimeForCategory` are removed, we can safely drop the columns.

- [ ] **Step 1: Remove columns from schema**

In `packages/db/src/schema/game-config.ts`, remove from `buildingDefinitions`:
```typescript
  buildTimeReductionFactor: real('build_time_reduction_factor'),
  reducesTimeForCategory: varchar('reduces_time_for_category', { length: 64 }).references(() => entityCategories.id, { onDelete: 'set null' }),
```

- [ ] **Step 2: Remove from GameConfig interfaces and assembly**

In `game-config.service.ts`:
- Remove `buildTimeReductionFactor` and `reducesTimeForCategory` from `BuildingConfig` interface
- Remove them from the building assembly in `getFullConfig()`
- Remove them from `createBuilding()` and `updateBuilding()` parameter types and DB calls

In `game-config.router.ts`:
- Remove from `createBuilding` and `updateBuilding` input schemas

- [ ] **Step 3: Generate and apply migration**

```bash
cd packages/db && pnpm drizzle-kit generate && pnpm drizzle-kit push
```

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/game-config.ts packages/db/drizzle/ apps/api/src/modules/admin/game-config.service.ts apps/api/src/modules/admin/game-config.router.ts
git commit -m "chore: remove deprecated buildTimeReductionFactor/reducesTimeForCategory columns"
```

---

### Task 15: Full verification

- [ ] **Step 1: Run all game-engine tests**

```bash
cd packages/game-engine && pnpm vitest run
```

Expected: All tests pass.

- [ ] **Step 2: TypeScript check all packages**

```bash
cd /Users/julienaubree/_projet/ogame-clone && pnpm tsc --noEmit -p packages/game-engine/tsconfig.json && pnpm tsc --noEmit -p apps/api/tsconfig.json && pnpm tsc --noEmit -p apps/admin/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 3: Fix any remaining issues and commit**

```bash
git add -A && git commit -m "fix: resolve any remaining type errors from bonus system migration"
```
