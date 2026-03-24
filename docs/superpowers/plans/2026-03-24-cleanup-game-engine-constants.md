# Cleanup Game-Engine Constants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete all 8 hardcoded constant files from `packages/game-engine/src/constants/` and remove all frontend fallbacks that reference them, making the DB config the sole source of truth.

**Architecture:** The constant data (BUILDINGS, RESEARCH, SHIPS, DEFENSES, COMBAT_STATS, SHIP_STATS, RAPID_FIRE, TUTORIAL_QUESTS, PHASE_MULTIPLIER) is already fully replicated in the DB and served via `gameConfig.getAll`. The frontend files `entity-details.ts` and `entity-names.ts` currently use the constants as fallbacks when config isn't available — these fallbacks are removed, falling back to `humanize(id)` instead. The `getPhaseMultiplier` utility function moves from `constants/progression.ts` into `formulas/building-cost.ts` (its only internal consumers already import it). Types that are only defined in constants files but used externally (`BuildingId`, `ShipId`, etc.) are no longer needed — all consumers use `string` IDs from the DB config.

**Tech Stack:** TypeScript, Vitest, game-engine package

---

## File Map

**Delete (8 files):**
- `packages/game-engine/src/constants/buildings.ts`
- `packages/game-engine/src/constants/research.ts`
- `packages/game-engine/src/constants/ships.ts`
- `packages/game-engine/src/constants/defenses.ts`
- `packages/game-engine/src/constants/combat-stats.ts`
- `packages/game-engine/src/constants/ship-stats.ts`
- `packages/game-engine/src/constants/tutorial-quests.ts`
- `packages/game-engine/src/constants/progression.ts`

**Modify:**
- `packages/game-engine/src/index.ts` — remove all `constants/` re-exports
- `packages/game-engine/src/formulas/building-cost.ts` — inline `getPhaseMultiplier`
- `packages/game-engine/src/formulas/research-cost.ts` — inline `getPhaseMultiplier`
- `apps/web/src/lib/entity-names.ts` — remove constant fallbacks
- `apps/web/src/lib/entity-details.ts` — remove constant fallbacks

---

### Task 1: Move `getPhaseMultiplier` out of `constants/progression.ts`

The function `getPhaseMultiplier` is imported by `building-cost.ts` and `research-cost.ts`. Move it inline into `building-cost.ts` and import it from there in `research-cost.ts`. Then delete `constants/progression.ts`.

**Files:**
- Modify: `packages/game-engine/src/formulas/building-cost.ts:1`
- Modify: `packages/game-engine/src/formulas/research-cost.ts:1`
- Delete: `packages/game-engine/src/constants/progression.ts`
- Modify: `packages/game-engine/src/index.ts:1`

- [ ] **Step 1: Move function into building-cost.ts**

Replace line 1 of `packages/game-engine/src/formulas/building-cost.ts`:

```ts
// OLD:
import { getPhaseMultiplier } from '../constants/progression.js';

// NEW: (add before the ResourceCost interface, around line 1)
const DEFAULT_PHASE_MULTIPLIER: Record<number, number> = {
  1: 0.35, 2: 0.45, 3: 0.55, 4: 0.65, 5: 0.78, 6: 0.90, 7: 0.95,
};

export function getPhaseMultiplier(level: number, phaseMap: Record<number, number> = DEFAULT_PHASE_MULTIPLIER): number {
  return phaseMap[level] ?? 1.0;
}
```

- [ ] **Step 2: Update research-cost.ts imports**

Replace lines 1-2 of `packages/game-engine/src/formulas/research-cost.ts`:

```ts
// OLD:
import { getPhaseMultiplier } from '../constants/progression.js';
import type { ResourceCost } from './building-cost.js';

// NEW:
import { getPhaseMultiplier, type ResourceCost } from './building-cost.js';
```

- [ ] **Step 3: Update index.ts**

In `packages/game-engine/src/index.ts`, replace:

```ts
// OLD:
export * from './constants/progression.js';

// NEW:  (remove the line entirely — getPhaseMultiplier is already exported via building-cost.ts line 5)
```

The `export * from './formulas/building-cost.js'` line already exists in index.ts, so `getPhaseMultiplier` remains exported.

- [ ] **Step 4: Delete constants/progression.ts**

Delete file: `packages/game-engine/src/constants/progression.ts`

- [ ] **Step 5: Run tests and TS check**

Run: `cd packages/game-engine && npx vitest run`
Expected: All 197 tests pass

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/building-cost.ts packages/game-engine/src/formulas/research-cost.ts packages/game-engine/src/index.ts
git rm packages/game-engine/src/constants/progression.ts
git commit -m "refactor: move getPhaseMultiplier from constants to formulas

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Delete unused constant files (tutorial-quests, combat-stats, ship-stats)

These 3 files are exported from `index.ts` but have **no external consumers** in the apps. `TUTORIAL_QUESTS` is not imported anywhere (seed has its own copy). `COMBAT_STATS`, `RAPID_FIRE`, and `SHIP_STATS` are only used in `entity-details.ts` as fallbacks — but that will be handled in Task 4. Since `entity-details.ts` will still compile (it gets these from the game-engine package), we delete the source files and remove the index exports now, then fix `entity-details.ts` in Task 4.

After removing these exports, `entity-details.ts` and `entity-names.ts` will fail to compile (they import `COMBAT_STATS`, `RAPID_FIRE`, `SHIP_STATS` which will no longer be exported) — this is intentional and fixed in Tasks 4-5.

**Note:** The spec mentions removing `SHIP_NAMES` from `mission-config.ts` and `RESEARCH_NAMES` from `entity-names.ts` — both are already absent from the codebase, no action required.

**Files:**
- Delete: `packages/game-engine/src/constants/tutorial-quests.ts`
- Delete: `packages/game-engine/src/constants/combat-stats.ts`
- Delete: `packages/game-engine/src/constants/ship-stats.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Remove exports from index.ts**

In `packages/game-engine/src/index.ts`, remove these 3 lines:

```ts
export * from './constants/tutorial-quests.js';
export { SHIP_STATS } from './constants/ship-stats.js';
export { COMBAT_STATS, RAPID_FIRE } from './constants/combat-stats.js';
```

Note: The types `UnitCombatStats` and `ShipStats` are already defined and exported from `formulas/combat.ts` and `formulas/fleet.ts` respectively, so consumers can still import them.

- [ ] **Step 2: Delete the 3 files**

```bash
rm packages/game-engine/src/constants/tutorial-quests.ts
rm packages/game-engine/src/constants/combat-stats.ts
rm packages/game-engine/src/constants/ship-stats.ts
```

- [ ] **Step 3: Run game-engine tests**

Run: `cd packages/game-engine && npx vitest run`
Expected: All tests pass (tests define their own local data, don't import from constants)

- [ ] **Step 4: TS check**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: No errors (API doesn't import these constants)

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: **ERRORS** in `entity-details.ts` — imports `COMBAT_STATS`, `RAPID_FIRE`, `SHIP_STATS` which no longer exist. This is expected and fixed in the next steps.

- [ ] **Step 5: Commit (partial — game-engine clean)**

```bash
git rm packages/game-engine/src/constants/tutorial-quests.ts packages/game-engine/src/constants/combat-stats.ts packages/game-engine/src/constants/ship-stats.ts
git add packages/game-engine/src/index.ts
git commit -m "refactor: delete unused tutorial-quests, combat-stats, ship-stats constants

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Delete entity definition constant files (buildings, research, ships, defenses)

Remove the remaining 4 constant files. After this, the entire `constants/` directory is empty and can be removed.

**Files:**
- Delete: `packages/game-engine/src/constants/buildings.ts`
- Delete: `packages/game-engine/src/constants/research.ts`
- Delete: `packages/game-engine/src/constants/ships.ts`
- Delete: `packages/game-engine/src/constants/defenses.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Remove exports from index.ts**

In `packages/game-engine/src/index.ts`, remove these 4 lines:

```ts
export * from './constants/buildings.js';
export * from './constants/research.js';
export * from './constants/ships.js';
export * from './constants/defenses.js';
```

- [ ] **Step 2: Delete the 4 files and the constants directory**

```bash
rm packages/game-engine/src/constants/buildings.ts
rm packages/game-engine/src/constants/research.ts
rm packages/game-engine/src/constants/ships.ts
rm packages/game-engine/src/constants/defenses.ts
rmdir packages/game-engine/src/constants
```

- [ ] **Step 3: Verify game-engine index.ts is clean**

The final `packages/game-engine/src/index.ts` should contain only formula and prerequisite exports:

```ts
export * from './formulas/production.js';
export * from './formulas/planet.js';
export * from './formulas/building-cost.js';
export * from './formulas/resources.js';
export * from './formulas/research-cost.js';
export * from './formulas/shipyard-cost.js';
export * from './formulas/fleet.js';
export * from './prerequisites/prerequisites.js';
export * from './formulas/ranking.js';
export * from './formulas/combat.js';
export * from './formulas/espionage.js';
export * from './formulas/pve.js';
export * from './formulas/bonus.js';
```

- [ ] **Step 4: Run game-engine tests and build**

Run: `cd packages/game-engine && npx vitest run`
Expected: All tests pass

Run: `cd packages/game-engine && npm run build`
Expected: Build succeeds

- [ ] **Step 4b: TS check apps (expect errors)**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: **ERRORS** in `entity-details.ts` AND `entity-names.ts` — imports of `BUILDINGS`, `RESEARCH`, `SHIPS`, `DEFENSES`, `BuildingId`, `ResearchId`, `ShipId`, `DefenseId` no longer exist. Fixed in Tasks 4-5.

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git rm -r packages/game-engine/src/constants/
git add packages/game-engine/src/index.ts
git commit -m "refactor: delete all game-engine entity constant files

The DB config is now the sole source of truth for buildings,
research, ships, and defenses definitions.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update `entity-names.ts` — remove constant fallbacks

This file imports `BUILDINGS`, `RESEARCH`, `SHIPS`, `DEFENSES` as name fallbacks. After Tasks 2-3, these no longer exist. Replace fallback chain with: `config?.X[id]?.name ?? humanize(id)`.

**Files:**
- Modify: `apps/web/src/lib/entity-names.ts`

- [ ] **Step 1: Rewrite entity-names.ts**

Replace the entire file content of `apps/web/src/lib/entity-names.ts` with:

```ts
/**
 * Centralized name resolver — never returns a raw ID.
 * Priority: gameConfig (DB) > humanized ID.
 */

interface GameConfigLike {
  buildings?: Record<string, { name: string }>;
  research?: Record<string, { name: string }>;
  ships?: Record<string, { name: string }>;
  defenses?: Record<string, { name: string }>;
}

function humanize(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').trim();
}

export function getBuildingName(id: string, config?: GameConfigLike | null): string {
  return config?.buildings?.[id]?.name ?? humanize(id);
}

export function getResearchName(id: string, config?: GameConfigLike | null): string {
  return config?.research?.[id]?.name ?? humanize(id);
}

export function getShipName(id: string, config?: GameConfigLike | null): string {
  return config?.ships?.[id]?.name ?? humanize(id);
}

export function getDefenseName(id: string, config?: GameConfigLike | null): string {
  return config?.defenses?.[id]?.name ?? humanize(id);
}

export function getUnitName(id: string, config?: GameConfigLike | null): string {
  return config?.ships?.[id]?.name
    ?? config?.defenses?.[id]?.name
    ?? humanize(id);
}

export function getEntityName(id: string, config?: GameConfigLike | null): string {
  return config?.buildings?.[id]?.name
    ?? config?.research?.[id]?.name
    ?? config?.ships?.[id]?.name
    ?? config?.defenses?.[id]?.name
    ?? humanize(id);
}
```

- [ ] **Step 2: TS check**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: Errors remain in `entity-details.ts` only (fixed in next task). `entity-names.ts` should be clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/entity-names.ts
git commit -m "refactor: remove game-engine constant fallbacks from entity-names.ts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Update `entity-details.ts` — remove constant fallbacks

This is the most complex migration. The file imports `BUILDINGS`, `RESEARCH`, `SHIPS`, `DEFENSES`, `COMBAT_STATS`, `RAPID_FIRE`, `SHIP_STATS` and uses them as fallbacks throughout. Since the config is always available when these functions are called (the frontend loads gameConfig on startup), we remove the fallbacks and rely solely on the config data. When config is missing, we return safe defaults (empty objects, `humanize(id)`).

**Files:**
- Modify: `apps/web/src/lib/entity-details.ts`

- [ ] **Step 1: Remove constant imports**

In `apps/web/src/lib/entity-details.ts`, replace lines 1-11:

```ts
// OLD:
import {
  BUILDINGS, type BuildingId,
  RESEARCH, type ResearchId,
  SHIPS, type ShipId,
  DEFENSES, type DefenseId,
  COMBAT_STATS, RAPID_FIRE, SHIP_STATS,
  mineraiProduction, siliciumProduction, hydrogeneProduction,
  solarPlantEnergy, mineraiMineEnergy, siliciumMineEnergy, hydrogeneSynthEnergy,
  storageCapacity,
} from '@ogame-clone/game-engine';
import { buildProductionConfig } from './production-config';

// NEW:
import {
  mineraiProduction, siliciumProduction, hydrogeneProduction,
  solarPlantEnergy, mineraiMineEnergy, siliciumMineEnergy, hydrogeneSynthEnergy,
  storageCapacity,
} from '@ogame-clone/game-engine';
import { buildProductionConfig } from './production-config';
```

- [ ] **Step 2: Update name resolver functions**

Replace the three name-resolver functions (lines ~92-107):

```ts
// OLD:
export function resolveBuildingName(id: string, config?: GameConfigData): string {
  return config?.buildings[id]?.name ?? BUILDINGS[id as BuildingId]?.name ?? humanize(id);
}

export function resolveResearchName(id: string, config?: GameConfigData): string {
  return config?.research[id]?.name ?? RESEARCH[id as ResearchId]?.name ?? humanize(id);
}

function resolveUnitName(id: string, config?: GameConfigData): string {
  return config?.ships[id]?.name ?? config?.defenses[id]?.name
    ?? SHIPS[id as ShipId]?.name ?? DEFENSES[id as DefenseId]?.name ?? humanize(id);
}

// NEW:
export function resolveBuildingName(id: string, config?: GameConfigData): string {
  return config?.buildings[id]?.name ?? humanize(id);
}

export function resolveResearchName(id: string, config?: GameConfigData): string {
  return config?.research[id]?.name ?? humanize(id);
}

function resolveUnitName(id: string, config?: GameConfigData): string {
  return config?.ships[id]?.name ?? config?.defenses[id]?.name ?? humanize(id);
}
```

- [ ] **Step 3: Update rapid fire helpers**

Replace the `getRapidFireAgainst` and `getRapidFireFrom` functions:

```ts
// OLD:
function getRapidFireAgainst(unitId: string, config?: GameConfigData): RapidFireEntry[] {
  const rf = config?.rapidFire ?? RAPID_FIRE;
  ...
}
function getRapidFireFrom(unitId: string, config?: GameConfigData): RapidFireEntry[] {
  const rf = config?.rapidFire ?? RAPID_FIRE;
  ...
}

// NEW:
function getRapidFireAgainst(unitId: string, config?: GameConfigData): RapidFireEntry[] {
  const rf = config?.rapidFire;
  if (!rf) return [];
  const targets = rf[unitId];
  if (!targets) return [];
  return Object.entries(targets).map(([targetId, value]) => ({
    unitId: targetId,
    unitName: resolveUnitName(targetId, config),
    value,
  }));
}

function getRapidFireFrom(unitId: string, config?: GameConfigData): RapidFireEntry[] {
  const rf = config?.rapidFire;
  if (!rf) return [];
  const entries: RapidFireEntry[] = [];
  for (const [attackerId, targets] of Object.entries(rf)) {
    if (targets[unitId]) {
      entries.push({
        unitId: attackerId,
        unitName: resolveUnitName(attackerId, config),
        value: targets[unitId],
      });
    }
  }
  return entries;
}
```

- [ ] **Step 4: Update `getBuildingDetails`**

Replace the function body to use config only:

```ts
export function getBuildingDetails(id: string, config?: GameConfigData, planet?: PlanetContext, fullConfig?: Parameters<typeof buildProductionConfig>[0]): BuildingDetails {
  const cfgDef = config?.buildings[id];
  const pf = planet?.productionFactor ?? 1;
  const maxTemp = planet?.maxTemp ?? 50;
  const prodConfig = fullConfig ? buildProductionConfig(fullConfig) : undefined;
  const details: BuildingDetails = {
    type: 'building',
    id,
    name: cfgDef?.name ?? humanize(id),
    description: cfgDef?.description ?? '',
    flavorText: cfgDef?.flavorText ?? '',
    baseCost: cfgDef?.baseCost ?? { minerai: 0, silicium: 0, hydrogene: 0 },
    costFactor: cfgDef?.costFactor ?? 1,
    prerequisites: cfgDef?.prerequisites ?? [],
  };

  switch (id) {
    case 'mineraiMine':
      details.productionTable = buildTable((lvl) => mineraiProduction(lvl, pf, prodConfig?.minerai));
      details.productionLabel = pf < 1 ? `Production minerai/h (energie: ${Math.round(pf * 100)}%)` : 'Production minerai/h';
      details.energyTable = buildTable((lvl) => mineraiMineEnergy(lvl, prodConfig?.mineraiEnergy));
      details.energyLabel = 'Consommation energie';
      break;
    case 'siliciumMine':
      details.productionTable = buildTable((lvl) => siliciumProduction(lvl, pf, prodConfig?.silicium));
      details.productionLabel = pf < 1 ? `Production silicium/h (energie: ${Math.round(pf * 100)}%)` : 'Production silicium/h';
      details.energyTable = buildTable((lvl) => siliciumMineEnergy(lvl, prodConfig?.siliciumEnergy));
      details.energyLabel = 'Consommation energie';
      break;
    case 'hydrogeneSynth':
      details.productionTable = buildTable((lvl) => hydrogeneProduction(lvl, maxTemp, pf, prodConfig?.hydrogene));
      details.productionLabel = `Production H\u2082/h (temp. ${maxTemp}${pf < 1 ? `, energie: ${Math.round(pf * 100)}%` : ''})`;
      details.energyTable = buildTable((lvl) => hydrogeneSynthEnergy(lvl, prodConfig?.hydrogeneEnergy));
      details.energyLabel = 'Consommation energie';
      break;
    case 'solarPlant':
      details.energyTable = buildTable((lvl) => solarPlantEnergy(lvl, prodConfig?.solar));
      details.energyLabel = 'Production energie';
      break;
    case 'storageMinerai':
    case 'storageSilicium':
    case 'storageHydrogene':
      details.storageTable = buildTable((lvl) => storageCapacity(lvl, prodConfig?.storage), 10);
      break;
  }

  return details;
}
```

Note: The `switch` on building IDs (`mineraiMine`, etc.) is acceptable here — these are role-based display behaviors that match building roles, not hardcoded entity references. The roles system (SP4) maps these IDs dynamically.

- [ ] **Step 5: Update `getResearchDetails`**

```ts
export function getResearchDetails(id: string, config?: GameConfigData): ResearchDetails {
  const cfgDef = config?.research[id];
  return {
    type: 'research',
    id,
    name: cfgDef?.name ?? humanize(id),
    description: cfgDef?.description ?? '',
    flavorText: cfgDef?.flavorText ?? '',
    effect: cfgDef?.effectDescription ?? '',
    baseCost: cfgDef?.baseCost ?? { minerai: 0, silicium: 0, hydrogene: 0 },
    costFactor: cfgDef?.costFactor ?? 1,
    prerequisites: cfgDef?.prerequisites ?? {},
  };
}
```

- [ ] **Step 6: Update `getShipDetails`**

```ts
export function getShipDetails(id: string, config?: GameConfigData): ShipDetails {
  const cfgDef = config?.ships[id];
  const combat = cfgDef
    ? { weapons: cfgDef.weapons, shield: cfgDef.shield, armor: cfgDef.armor }
    : { weapons: 0, shield: 0, armor: 0 };
  const stats = cfgDef
    ? { baseSpeed: cfgDef.baseSpeed, fuelConsumption: cfgDef.fuelConsumption, cargoCapacity: cfgDef.cargoCapacity, driveType: cfgDef.driveType, miningExtraction: cfgDef.miningExtraction ?? 0 }
    : { baseSpeed: 0, fuelConsumption: 0, cargoCapacity: 0, driveType: 'combustion' as string, miningExtraction: 0 };
  return {
    type: 'ship',
    id,
    name: cfgDef?.name ?? humanize(id),
    description: cfgDef?.description ?? '',
    flavorText: cfgDef?.flavorText ?? '',
    cost: cfgDef?.cost ?? { minerai: 0, silicium: 0, hydrogene: 0 },
    prerequisites: cfgDef?.prerequisites ?? {},
    combat,
    stats,
    isStationary: cfgDef?.isStationary ?? false,
    rapidFireAgainst: getRapidFireAgainst(id, config),
    rapidFireFrom: getRapidFireFrom(id, config),
  };
}
```

- [ ] **Step 7: Update `getDefenseDetails`**

```ts
export function getDefenseDetails(id: string, config?: GameConfigData): DefenseDetails {
  const cfgDef = config?.defenses[id];
  const combat = cfgDef
    ? { weapons: cfgDef.weapons, shield: cfgDef.shield, armor: cfgDef.armor }
    : { weapons: 0, shield: 0, armor: 0 };
  return {
    type: 'defense',
    id,
    name: cfgDef?.name ?? humanize(id),
    description: cfgDef?.description ?? '',
    flavorText: cfgDef?.flavorText ?? '',
    cost: cfgDef?.cost ?? { minerai: 0, silicium: 0, hydrogene: 0 },
    prerequisites: cfgDef?.prerequisites ?? {},
    combat,
    rapidFireFrom: getRapidFireFrom(id, config),
    maxPerPlanet: cfgDef?.maxPerPlanet,
  };
}
```

- [ ] **Step 8: Run TS checks on all projects**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/web/tsconfig.json && npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/admin/tsconfig.json`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/entity-details.ts
git commit -m "refactor: remove game-engine constant fallbacks from entity-details.ts

Config from DB is now the sole data source for entity details.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Final verification and cleanup

Run full test suites, TS checks, build, and verify no remaining imports from deleted constants.

**Files:** None (verification only)

- [ ] **Step 1: Run all game-engine tests**

Run: `cd packages/game-engine && npx vitest run`
Expected: All 197 tests pass

- [ ] **Step 2: Run API tests**

Run: `cd apps/api && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: TS check all projects**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json && npx tsc --noEmit -p apps/admin/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Build game-engine**

Run: `cd packages/game-engine && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Verify no remaining constant imports**

Run: `grep -rn "from.*game-engine.*constants" --include="*.ts" /Users/julienaubree/_projet/ogame-clone/ | grep -v node_modules | grep -v /dist/`
Expected: No matches

Run: `grep -rn "BUILDINGS\|SHIPS\b.*=\|RESEARCH\b.*=\|DEFENSES\|COMBAT_STATS\|SHIP_STATS\|RAPID_FIRE\|TUTORIAL_QUESTS" --include="*.ts" /Users/julienaubree/_projet/ogame-clone/apps/ | grep -v node_modules | grep -v /dist/ | grep -v ".test."`
Expected: No matches (or only local variables with same names in test files)

- [ ] **Step 6: Verify constants directory is gone**

Run: `ls packages/game-engine/src/constants/ 2>&1`
Expected: "No such file or directory"

- [ ] **Step 7: Push**

```bash
git push
```
