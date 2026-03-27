# Slag & Deep Space Refining Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slag system to mining that reduces effective cargo and accelerates deposit depletion, with a new "deep space refining" tech to mitigate it.

**Architecture:** Slag rates are stored in `universe_config` (DB). A new `deepSpaceRefining` research reduces slag multiplicatively (`0.85^level`). The extraction formula in `pve.ts` is modified to return `{ playerReceives, depositLoss }`. The mine handler passes `depositLoss` to `extractFromDeposit` and derives `playerReceives` from the return value.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, tRPC, React, Vitest

---

## Chunk 1: Backend (DB + Game Engine + API)

### Task 1: DB Schema — Add `deepSpaceRefining` column and `maxLevel`

**Files:**
- Modify: `packages/db/src/schema/user-research.ts`
- Modify: `packages/db/src/schema/game-config.ts` (researchDefinitions table)

- [ ] **Step 1: Add `deepSpaceRefining` to user_research schema**

In `packages/db/src/schema/user-research.ts`, add after the `rockFracturing` line:

```typescript
deepSpaceRefining: smallint('deep_space_refining').notNull().default(0),
```

- [ ] **Step 2: Add `maxLevel` to researchDefinitions schema**

In `packages/db/src/schema/game-config.ts`, first add `smallint` to the import from `drizzle-orm/pg-core`:

```typescript
import { pgTable, varchar, text, integer, real, jsonb, primaryKey, smallint } from 'drizzle-orm/pg-core';
```

Then add to the `researchDefinitions` table after the `effectDescription` column:

```typescript
maxLevel: smallint('max_level'),
```

- [ ] **Step 3: Generate Drizzle migration**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter @exilium/db drizzle-kit generate`

Expected: A new migration file is created in `packages/db/drizzle/`

- [ ] **Step 4: Run migration**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter @exilium/db drizzle-kit push`

Expected: Migration applied successfully

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/user-research.ts packages/db/src/schema/game-config.ts packages/db/drizzle/
git commit -m "feat(db): add deepSpaceRefining column and maxLevel to research"
```

### Task 2: Seed — Add deepSpaceRefining research and slag rates

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Add deepSpaceRefining to RESEARCH array**

In `packages/db/src/seed-game-config.ts`, add after the `rockFracturing` entry (line ~83):

```typescript
{ id: 'deepSpaceRefining', name: 'Raffinage en espace lointain', description: "Developpe des techniques de raffinage embarquees qui reduisent les scories lors de l'extraction miniere.", baseCostMinerai: 2000, baseCostSilicium: 4000, baseCostHydrogene: 1000, costFactor: 2, levelColumn: 'deepSpaceRefining', categoryId: 'research_sciences', sortOrder: 10, flavorText: "Des nanofiltres embarques separent les scories du minerai pur directement dans la soute du prospecteur, maximisant chaque voyage.", effectDescription: "Chaque niveau reduit les scories de 15% (multiplicatif). Niveau 15 : ~2.5% de scories restantes.", prerequisites: { buildings: [{ buildingId: 'missionCenter', level: 2 }], research: [{ researchId: 'rockFracturing', level: 2 }] } },
```

- [ ] **Step 2: Add slag rate entries to UNIVERSE_CONFIG array**

In `packages/db/src/seed-game-config.ts`, add to the `UNIVERSE_CONFIG` array (after line ~331):

```typescript
// Slag rates (scories) — per position and resource type
// NOTE: deepSpaceRefining has no bonus_definitions entry. Its reduction is multiplicative
// (0.85^level), incompatible with resolveBonus's linear formula. Computed directly in pve.ts.
{ key: 'slag_rate.pos8.minerai', value: 0.35 },
{ key: 'slag_rate.pos8.silicium', value: 0.30 },
{ key: 'slag_rate.pos8.hydrogene', value: 0.20 },
{ key: 'slag_rate.pos16.minerai', value: 0.20 },
{ key: 'slag_rate.pos16.silicium', value: 0.15 },
{ key: 'slag_rate.pos16.hydrogene', value: 0.10 },
```

- [ ] **Step 3: Run seed**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter @exilium/db seed`

Expected: Seed completes with research and universe config counts incremented

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(db): seed deepSpaceRefining research and slag rates"
```

### Task 3: Shared Types — Add deepSpaceRefining to ResearchId

**Files:**
- Modify: `packages/game-engine/src/constants/research.ts`

- [ ] **Step 1: Add to ResearchId union type**

In `packages/game-engine/src/constants/research.ts`, add `'deepSpaceRefining'` to the `ResearchId` type union (after `'rockFracturing'`):

```typescript
export type ResearchId =
  | 'espionageTech'
  | 'computerTech'
  | 'energyTech'
  | 'combustion'
  | 'impulse'
  | 'hyperspaceDrive'
  | 'weapons'
  | 'shielding'
  | 'armor'
  | 'rockFracturing'
  | 'deepSpaceRefining';
```

- [ ] **Step 2: Add `maxLevel` to ResearchDefinition interface**

```typescript
export interface ResearchDefinition {
  id: ResearchId;
  name: string;
  description: string;
  baseCost: { minerai: number; silicium: number; hydrogene: number };
  costFactor: number;
  maxLevel?: number;
  prerequisites: {
    buildings?: { buildingId: string; level: number }[];
    research?: { researchId: ResearchId; level: number }[];
  };
}
```

- [ ] **Step 3: Add deepSpaceRefining to RESEARCH record**

Add after the `rockFracturing` entry:

```typescript
deepSpaceRefining: {
  id: 'deepSpaceRefining',
  name: 'Raffinage en espace lointain',
  description: 'Développe des techniques de raffinage embarquées qui réduisent les scories lors de l\'extraction minière.',
  baseCost: { minerai: 2000, silicium: 4000, hydrogene: 1000 },
  costFactor: 2,
  maxLevel: 15,
  prerequisites: {
    buildings: [{ buildingId: 'missionCenter', level: 2 }],
    research: [{ researchId: 'rockFracturing', level: 2 }],
  },
},
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter @exilium/game-engine tsc --noEmit`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/game-engine/src/constants/research.ts
git commit -m "feat(game-engine): add deepSpaceRefining to ResearchId and RESEARCH"
```

### Task 4: Game Engine — Slag formulas (TDD)

**Files:**
- Modify: `packages/game-engine/src/formulas/pve.ts`
- Modify: `packages/game-engine/src/formulas/pve.test.ts`

- [ ] **Step 1: Write failing tests for slag functions**

Add to `packages/game-engine/src/formulas/pve.test.ts`:

```typescript
import {
  baseExtraction,
  totalExtracted,
  prospectionDuration,
  miningDuration,
  poolSize,
  accumulationCap,
  computeSlagRate,
  computeMiningExtraction,
} from './pve.js';

describe('computeSlagRate', () => {
  it('returns baseSlagRate when refining level is 0', () => {
    expect(computeSlagRate(0.35, 0)).toBeCloseTo(0.35);
  });

  it('reduces multiplicatively at level 3', () => {
    expect(computeSlagRate(0.30, 3)).toBeCloseTo(0.30 * 0.85 ** 3);
  });

  it('reduces to ~2.5% at level 15 with 30% base', () => {
    expect(computeSlagRate(0.30, 15)).toBeCloseTo(0.30 * 0.85 ** 15);
  });

  it('clamps to 0.99 max if baseSlagRate is misconfigured', () => {
    expect(computeSlagRate(1.5, 0)).toBe(0.99);
  });

  it('clamps to 0 min', () => {
    expect(computeSlagRate(-0.1, 0)).toBe(0);
  });
});

describe('computeMiningExtraction', () => {
  it('reduces effective cargo and increases deposit loss', () => {
    const result = computeMiningExtraction({
      centerLevel: 1,
      nbProspectors: 3,
      cargoCapacity: 10000,
      depositRemaining: 100000,
      slagRate: 0.30,
    });
    // baseExtraction(1) * 3 = 6000
    // effectiveCargo = 10000 * 0.70 = 7000
    // maxExtractable = min(6000, 7000) = 6000
    // depositLoss = 6000 / 0.70 = 8571.43
    expect(result.playerReceives).toBe(6000);
    expect(result.depositLoss).toBeCloseTo(8571.43, 0);
  });

  it('caps at effective cargo when extraction exceeds it', () => {
    const result = computeMiningExtraction({
      centerLevel: 10,
      nbProspectors: 10,
      cargoCapacity: 10000,
      depositRemaining: 500000,
      slagRate: 0.30,
    });
    // baseExtraction(10) * 10 = 92000
    // effectiveCargo = 10000 * 0.70 = 7000
    // maxExtractable = min(92000, 7000) = 7000
    expect(result.playerReceives).toBe(7000);
    expect(result.depositLoss).toBeCloseTo(10000, 0);
  });

  it('handles deposit nearly depleted (less than depositLoss)', () => {
    const result = computeMiningExtraction({
      centerLevel: 1,
      nbProspectors: 3,
      cargoCapacity: 10000,
      depositRemaining: 500,
      slagRate: 0.30,
    });
    // depositRemaining (500) < depositLoss
    // playerReceives = 500 * 0.70 = 350
    expect(result.playerReceives).toBe(350);
    expect(result.depositLoss).toBe(500);
  });

  it('returns full extraction when slagRate is 0', () => {
    const result = computeMiningExtraction({
      centerLevel: 1,
      nbProspectors: 3,
      cargoCapacity: 10000,
      depositRemaining: 100000,
      slagRate: 0,
    });
    expect(result.playerReceives).toBe(6000);
    expect(result.depositLoss).toBe(6000);
  });

  it('handles very high slag rate (0.99)', () => {
    const result = computeMiningExtraction({
      centerLevel: 1,
      nbProspectors: 3,
      cargoCapacity: 10000,
      depositRemaining: 100000,
      slagRate: 0.99,
    });
    // effectiveCargo = 10000 * 0.01 = 100
    // maxExtractable = min(6000, 100) = 100
    // depositLoss = 100 / 0.01 = 10000
    expect(result.playerReceives).toBe(100);
    expect(result.depositLoss).toBe(10000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter @exilium/game-engine vitest run src/formulas/pve.test.ts`

Expected: FAIL — `computeSlagRate` and `computeMiningExtraction` are not exported

- [ ] **Step 3: Implement slag functions**

Add to `packages/game-engine/src/formulas/pve.ts`:

```typescript
/**
 * Compute effective slag rate after deep space refining tech.
 * Formula: clamp(baseSlagRate * 0.85^refiningLevel, 0, 0.99)
 */
export function computeSlagRate(baseSlagRate: number, refiningLevel: number): number {
  const rate = baseSlagRate * Math.pow(0.85, refiningLevel);
  return Math.min(0.99, Math.max(0, rate));
}

/**
 * Compute mining extraction with slag mechanics.
 * Returns playerReceives (net resources) and depositLoss (gross deducted from deposit).
 */
export function computeMiningExtraction(params: {
  centerLevel: number;
  nbProspectors: number;
  cargoCapacity: number;
  depositRemaining: number;
  slagRate: number;
}): { playerReceives: number; depositLoss: number } {
  const { centerLevel, nbProspectors, cargoCapacity, depositRemaining, slagRate } = params;
  const effectiveProspectors = Math.min(nbProspectors, 10);
  const rawExtraction = baseExtraction(centerLevel) * effectiveProspectors;
  const effectiveCargo = cargoCapacity * (1 - slagRate);
  const maxExtractable = Math.min(rawExtraction, effectiveCargo);

  if (slagRate === 0) {
    const capped = Math.min(maxExtractable, depositRemaining);
    return { playerReceives: capped, depositLoss: capped };
  }

  const depositLoss = maxExtractable / (1 - slagRate);

  if (depositRemaining >= depositLoss) {
    return { playerReceives: maxExtractable, depositLoss };
  }

  return {
    playerReceives: Math.floor(depositRemaining * (1 - slagRate)),
    depositLoss: depositRemaining,
  };
}
```

- [ ] **Step 4: Export new functions from index**

Check `packages/game-engine/src/index.ts` — it re-exports from `./formulas/pve.js` with `export *`, so the new exports should be automatic. Verify:

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter @exilium/game-engine tsc --noEmit`

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter @exilium/game-engine vitest run src/formulas/pve.test.ts`

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/pve.ts packages/game-engine/src/formulas/pve.test.ts
git commit -m "feat(game-engine): add slag rate and mining extraction formulas (TDD)"
```

### Task 5: GameConfig Service — Expose maxLevel and slag rates

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.service.ts`

- [ ] **Step 1: Add `maxLevel` to ResearchConfig interface**

In `apps/api/src/modules/admin/game-config.service.ts`, add to the `ResearchConfig` interface (after `sortOrder`):

```typescript
maxLevel: number | null;
```

- [ ] **Step 2: Update getFullConfig to read maxLevel**

In the `getFullConfig()` function, find the research mapping block (around line ~250-265 where `research[r.id]` is built). Add `maxLevel` to the mapped object, after `sortOrder`:

```typescript
research[r.id] = {
  // ... existing fields ...
  sortOrder: r.sortOrder,
  maxLevel: r.maxLevel ?? null,
  prerequisites: {
    // ... existing ...
  },
};
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api tsc --noEmit`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/admin/game-config.service.ts
git commit -m "feat(api): expose maxLevel and slag rates in GameConfig"
```

### Task 6: Research Service — Enforce maxLevel

**Files:**
- Modify: `apps/api/src/modules/research/research.service.ts`

- [ ] **Step 1: Add maxLevel check in startResearch**

In `apps/api/src/modules/research/research.service.ts`, after line ~111 (`const nextLevel = currentLevel + 1;`), add:

```typescript
if (def.maxLevel != null && nextLevel > def.maxLevel) {
  throw new TRPCError({ code: 'BAD_REQUEST', message: `Niveau maximum atteint (${def.maxLevel})` });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/research/research.service.ts
git commit -m "feat(api): enforce maxLevel on research"
```

### Task 7: Mine Handler — Integrate slag formulas

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/mine.handler.ts`

- [ ] **Step 1: Update imports**

In `mine.handler.ts`, update the import from `@exilium/game-engine`:

```typescript
import { prospectionDuration, miningDuration, totalCargoCapacity, resolveBonus, computeSlagRate, computeMiningExtraction } from '@exilium/game-engine';
```

Remove `totalExtracted` from imports (no longer used directly).

- [ ] **Step 2: Modify processMineDone to use slag formulas**

Replace the extraction logic in `processMineDone` (lines ~126-143) with:

```typescript
// Extract resources with slag
const params = mission.parameters as { depositId: string; resourceType: string };
const centerLevel = await ctx.pveService.getMissionCenterLevel(fleetEvent.userId);
const prospectorCount = ships['prospector'] ?? 0;
const config = await ctx.gameConfigService.getFullConfig();
const shipStatsMap = buildShipStatsMap(config);
const cargoCapacity = totalCargoCapacity(ships, shipStatsMap);

// Get slag rate from config
const position = fleetEvent.targetPosition as 8 | 16;
const slagKey = `slag_rate.pos${position}.${params.resourceType}`;
const baseSlagRate = Number(config.universe[slagKey] ?? 0);

// Get refining level
const [research] = await ctx.db.select().from(userResearch).where(eq(userResearch.userId, fleetEvent.userId)).limit(1);
const refiningLevel = research?.deepSpaceRefining ?? 0;
const slagRate = computeSlagRate(baseSlagRate, refiningLevel);

// Compute extraction with slag
const [deposit] = await ctx.db.select().from(asteroidDeposits)
  .where(eq(asteroidDeposits.id, params.depositId)).limit(1);
const depositRemaining = deposit ? Number(deposit.remainingQuantity) : 0;
const extraction = computeMiningExtraction({
  centerLevel,
  nbProspectors: prospectorCount,
  cargoCapacity,
  depositRemaining,
  slagRate,
});

// extractFromDeposit handles atomicity — derive playerReceives from actual extracted
const actualDeducted = await ctx.asteroidBeltService.extractFromDeposit(params.depositId, extraction.depositLoss);
const playerReceives = slagRate > 0
  ? Math.floor(actualDeducted * (1 - slagRate))
  : actualDeducted;

const cargo = { minerai: 0, silicium: 0, hydrogene: 0 };
if (playerReceives > 0) {
  cargo[params.resourceType as keyof typeof cargo] = playerReceives;
}
```

- [ ] **Step 3: Update mining report message**

Replace the message building section (lines ~158-168) with:

```typescript
if (ctx.messageService) {
  const parts = [`Extraction terminée en ${coords}\n`];
  parts.push(`Durée totale : ${totalDuration}`);
  parts.push(`Ressource extraite : ${playerReceives} ${params.resourceType}`);
  if (slagRate > 0) {
    const slagPct = Math.round(slagRate * 100);
    const slagLost = actualDeducted - playerReceives;
    parts.push(`Scories : ${slagPct}% — ${slagLost} tonnes perdues`);
  }
  await ctx.messageService.createSystemMessage(
    fleetEvent.userId,
    'mission',
    `Extraction terminée ${coords}`,
    parts.join('\n'),
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter api tsc --noEmit`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/mine.handler.ts
git commit -m "feat(api): integrate slag formulas into mine handler"
```

## Chunk 2: Frontend

### Task 8: FleetSummaryBar — Show effective cargo for mine missions

**Files:**
- Modify: `apps/web/src/components/fleet/FleetSummaryBar.tsx`

- [ ] **Step 1: Add `effectiveCargo` and `mission` display to FleetSummaryBar**

Add an optional `effectiveCargo` prop to `FleetSummaryBarProps`:

```typescript
effectiveCargo?: number;
```

Update the cargo display to show effective cargo when it differs from total cargo:

```typescript
{shipCount > 0 ? (
  <>
    {shipCount} vaisseau{shipCount > 1 ? 'x' : ''} &bull; Cargo{effectiveCargo != null && effectiveCargo < cargoCapacity
      ? <> utile : {effectiveCargo.toLocaleString()}/{cargoCapacity.toLocaleString()}</>
      : <> : {totalCargo.toLocaleString()}/{cargoCapacity.toLocaleString()}</>
    }
  </>
) : (
  'Aucun vaisseau sélectionné'
)}
```

- [ ] **Step 2: Pass effectiveCargo from Fleet.tsx**

In `apps/web/src/pages/Fleet.tsx`, find where `FleetSummaryBar` is rendered. When mission is `mine`, compute effective cargo:
- Read slag rates from game config's `universe` record
- Read the user's `deepSpaceRefining` level from research levels
- Compute `slagRate = baseSlagRate * 0.85^refiningLevel`
- Pass `effectiveCargo={Math.floor(cargoCapacity * (1 - slagRate))}` to `FleetSummaryBar`

This requires importing `computeSlagRate` from `@exilium/game-engine`.

- [ ] **Step 3: Verify it builds**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter web build`

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/fleet/FleetSummaryBar.tsx apps/web/src/pages/Fleet.tsx
git commit -m "feat(web): show effective cargo with slag reduction in fleet summary"
```

### Task 9: ResearchDetailContent — Show slag info for deepSpaceRefining

**Files:**
- Modify: `apps/web/src/components/entity-details/ResearchDetailContent.tsx`

- [ ] **Step 1: Add slag progression display for deepSpaceRefining**

In `ResearchDetailContent.tsx`, add a custom section after the "Effet en jeu" block that only shows for `deepSpaceRefining`:

```typescript
{researchId === 'deepSpaceRefining' && gameConfig?.universe && (
  <div>
    <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-2">
      Taux de scories actuel
    </div>
    <div className="space-y-1 text-[11px]">
      {[8, 16].map((pos) => {
        const resources = ['minerai', 'silicium', 'hydrogene'] as const;
        return resources.map((res) => {
          const baseRate = Number(gameConfig.universe[`slag_rate.pos${pos}.${res}`] ?? 0);
          const effectiveRate = baseRate * Math.pow(0.85, currentLevel);
          const effectivePct = (effectiveRate * 100).toFixed(1);
          return (
            <div key={`${pos}-${res}`} className="flex justify-between text-slate-300">
              <span>Pos {pos} — {res}</span>
              <span className="text-emerald-400">{effectivePct}%</span>
            </div>
          );
        });
      })}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify it builds**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter web build`

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/entity-details/ResearchDetailContent.tsx
git commit -m "feat(web): show slag rates in deepSpaceRefining research card"
```

### Task 10: Final verification and push

- [ ] **Step 1: Run all tests**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm test`

Expected: All tests pass

- [ ] **Step 2: Run full TypeScript check**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Push**

```bash
git push
```
