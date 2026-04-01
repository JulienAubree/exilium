# Armored Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected resource system where hangars + a new research protect a portion of resources from being pillaged during attacks.

**Architecture:** New `armoredStorage` research column in user_research, new `calculateProtectedResources` function in game-engine, modified loot calculation in attack handler that subtracts protected amount before applying pillage ratio, and frontend indicators on Overview gauges + building details + combat reports.

**Tech Stack:** Drizzle ORM, game-engine (TypeScript), React, tRPC, Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/db/src/schema/user-research.ts` | Add `armoredStorage` column |
| Modify | `packages/db/src/seed-game-config.ts` | Add research entry, bonus, universe config |
| Create | `packages/game-engine/src/formulas/armored-storage.ts` | `calculateProtectedResources` function |
| Modify | `packages/game-engine/src/index.ts` | Export new module |
| Modify | `apps/api/src/modules/fleet/handlers/attack.handler.ts` | Use protected resources in loot calc |
| Modify | `apps/web/src/pages/Overview.tsx` | Protection indicator on resource gauges |
| Modify | `apps/web/src/components/entity-details/BuildingDetailContent.tsx` | Show armored capacity for storage buildings |
| Modify | `apps/web/src/components/reports/CombatReportDetail.tsx` | Show protected resources section |

---

### Task 1: DB — Add armoredStorage column to user_research

**Files:**
- Modify: `packages/db/src/schema/user-research.ts`

- [ ] **Step 1: Add the column**

Add after the last column (`semiconductors`):

```typescript
  armoredStorage: smallint('armored_storage').notNull().default(0),
```

- [ ] **Step 2: Generate and run migration**

```bash
cd packages/db && npx drizzle-kit generate && npx drizzle-kit push
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/
git commit -m "feat(armored-storage): add armoredStorage column to user_research"
```

---

### Task 2: Game Config — Add research, bonus, and universe config

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Add universe config key**

In the `UNIVERSE` array, add after the `combat_pillage_ratio` entry:

```typescript
  { key: 'protected_storage_base_ratio', value: 0.05 },
```

- [ ] **Step 2: Add research entry**

In the `RESEARCH` array, add:

```typescript
  {
    id: 'armoredStorage',
    name: 'Blindage des hangars',
    description: 'Renforce les hangars pour protéger une partie des ressources contre le pillage.',
    baseCostMinerai: 1000,
    baseCostSilicium: 1000,
    baseCostHydrogene: 0,
    costFactor: 2,
    levelColumn: 'armoredStorage',
    categoryId: 'research_defense',
    sortOrder: 50,
    flavorText: 'Un blindage moléculaire rend une partie du stockage totalement inaccessible aux pilleurs.',
    effectDescription: 'Chaque niveau augmente de 5% la capacité blindée des hangars, protégeant les ressources du pillage.',
    prerequisites: {
      buildings: [{ buildingId: 'storageMinerai', level: 2 }],
      research: [],
    },
  },
```

- [ ] **Step 3: Add bonus entry**

In the `BONUSES` array, add:

```typescript
  { sourceType: 'research', sourceId: 'armoredStorage', stat: 'armored_storage', percentPerLevel: 5, category: null, statLabel: 'Protection blindée' },
```

- [ ] **Step 4: Re-seed the game config**

```bash
cd packages/db && npx tsx src/seed-game-config.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(armored-storage): add research, bonus, and universe config"
```

---

### Task 3: Game Engine — calculateProtectedResources function

**Files:**
- Create: `packages/game-engine/src/formulas/armored-storage.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Create the armored-storage module**

```typescript
import { storageCapacity } from './production.js';
import { resolveBonus, type BonusDefinition } from './bonus.js';

export interface ProtectedResourcesInput {
  storageMineraiLevel: number;
  storageSiliciumLevel: number;
  storageHydrogeneLevel: number;
  /** Current stock */
  minerai: number;
  silicium: number;
  hydrogene: number;
}

export interface ProtectedResources {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

/**
 * Calculate how much of each resource is protected from pillage.
 * Protection = storageCapacity × baseRatio × resolveBonus('armored_storage')
 * Capped at actual stock (can't protect more than you have).
 */
export function calculateProtectedResources(
  input: ProtectedResourcesInput,
  baseRatio: number,
  researchLevels: Record<string, number>,
  bonusDefs: BonusDefinition[],
  storageConfig?: { storageBase: number; coeffA: number; coeffB: number; coeffC: number },
  talentBonuses?: Record<string, number>,
): ProtectedResources {
  const bonus = resolveBonus('armored_storage', null, researchLevels, bonusDefs);
  // resolveBonus returns 1 when no match, or 1 + percentPerLevel/100 * level for research
  // So multiply: storageCapacity * baseRatio * bonus

  const storageMineraiCap = storageCapacity(input.storageMineraiLevel, storageConfig) *
    (1 + (talentBonuses?.['storage_minerai'] ?? 0));
  const storageSiliciumCap = storageCapacity(input.storageSiliciumLevel, storageConfig) *
    (1 + (talentBonuses?.['storage_silicium'] ?? 0));
  const storageHydrogeneCap = storageCapacity(input.storageHydrogeneLevel, storageConfig) *
    (1 + (talentBonuses?.['storage_hydrogene'] ?? 0));

  return {
    minerai: Math.min(input.minerai, Math.floor(storageMineraiCap * baseRatio * bonus)),
    silicium: Math.min(input.silicium, Math.floor(storageSiliciumCap * baseRatio * bonus)),
    hydrogene: Math.min(input.hydrogene, Math.floor(storageHydrogeneCap * baseRatio * bonus)),
  };
}
```

- [ ] **Step 2: Export from index.ts**

Add to `packages/game-engine/src/index.ts`:

```typescript
export * from './formulas/armored-storage.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/formulas/armored-storage.ts packages/game-engine/src/index.ts
git commit -m "feat(armored-storage): add calculateProtectedResources function"
```

---

### Task 4: Backend — Modify attack handler loot calculation

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/attack.handler.ts`

- [ ] **Step 1: Add imports**

Add to the import from `@exilium/game-engine`:

```typescript
import { simulateCombat, totalCargoCapacity, calculateShieldCapacity, calculateProtectedResources, storageCapacity } from '@exilium/game-engine';
```

Also add `userResearch` to the `@exilium/db` import:

```typescript
import { planets, planetShips, planetDefenses, planetBuildings, userResearch } from '@exilium/db';
```

- [ ] **Step 2: Modify the pillage section**

In `processArrival`, the pillage calculation (around line 247-293) currently does:

```typescript
if (outcome === 'attacker') {
  // ... cargo calc ...
  if (availableCargo > 0) {
    await ctx.resourceService.materializeResources(targetPlanet.id, targetPlanet.userId);
    const [updatedPlanet] = await ctx.db.select().from(planets).where(eq(planets.id, targetPlanet.id)).limit(1);

    const pillageProtection = 1 - Math.min(0.9, defenderTalentCtx['pillage_protection'] ?? 0);
    const ratio = combatConfig.pillageRatio;
    const availMinerai = Math.floor(Number(updatedPlanet.minerai) * ratio * pillageProtection);
    const availSilicium = Math.floor(Number(updatedPlanet.silicium) * ratio * pillageProtection);
    const availHydrogene = Math.floor(Number(updatedPlanet.hydrogene) * ratio * pillageProtection);
```

Replace the section from `const pillageProtection` to `const availHydrogene` with:

```typescript
    const pillageProtection = 1 - Math.min(0.9, defenderTalentCtx['pillage_protection'] ?? 0);
    const ratio = combatConfig.pillageRatio;

    // Armored storage: subtract protected resources before applying pillage ratio
    const defenderBuildingLevels = await ctx.resourceService.getBuildingLevels(targetPlanet.id);
    const config = await ctx.gameConfigService.getFullConfig();
    const baseRatio = Number(config.universe['protected_storage_base_ratio']) || 0.05;
    const [defenderResearch] = await ctx.db.select().from(userResearch).where(eq(userResearch.userId, targetPlanet.userId)).limit(1);
    const defResearchLevels: Record<string, number> = {};
    if (defenderResearch) {
      for (const [key, value] of Object.entries(defenderResearch)) {
        if (key !== 'userId' && typeof value === 'number') defResearchLevels[key] = value;
      }
    }

    const storageRoleMap = {
      storageMineraiLevel: defenderBuildingLevels[config.buildings ? Object.entries(config.buildings).find(([, b]) => (b as any).role === 'storage_minerai')?.[0] ?? 'storageMinerai' : 'storageMinerai'] ?? 0,
      storageSiliciumLevel: defenderBuildingLevels[Object.entries(config.buildings).find(([, b]) => (b as any).role === 'storage_silicium')?.[0] ?? 'storageSilicium'] ?? 0,
      storageHydrogeneLevel: defenderBuildingLevels[Object.entries(config.buildings).find(([, b]) => (b as any).role === 'storage_hydrogene')?.[0] ?? 'storageHydrogene'] ?? 0,
    };

    const protectedRes = calculateProtectedResources(
      {
        ...storageRoleMap,
        minerai: Number(updatedPlanet.minerai),
        silicium: Number(updatedPlanet.silicium),
        hydrogene: Number(updatedPlanet.hydrogene),
      },
      baseRatio,
      defResearchLevels,
      config.bonuses,
    );

    const availMinerai = Math.floor(Math.max(0, Number(updatedPlanet.minerai) - protectedRes.minerai) * ratio * pillageProtection);
    const availSilicium = Math.floor(Math.max(0, Number(updatedPlanet.silicium) - protectedRes.silicium) * ratio * pillageProtection);
    const availHydrogene = Math.floor(Math.max(0, Number(updatedPlanet.hydrogene) - protectedRes.hydrogene) * ratio * pillageProtection);
```

- [ ] **Step 3: Add protectedResources to combat report**

After `reportResult.pillage = { ... }` (around line 334-339), add:

```typescript
      if (outcome === 'attacker') {
        reportResult.pillage = {
          minerai: pillagedMinerai,
          silicium: pillagedSilicium,
          hydrogene: pillagedHydrogene,
        };
        reportResult.protectedResources = {
          minerai: protectedRes.minerai,
          silicium: protectedRes.silicium,
          hydrogene: protectedRes.hydrogene,
        };
      }
```

Note: `protectedRes` must be hoisted outside the `if (availableCargo > 0)` block, or the report section needs to be inside that block. Check the exact scope — if `protectedRes` is inside `if (availableCargo > 0)`, declare a top-level variable:

```typescript
    let protectedResources = { minerai: 0, silicium: 0, hydrogene: 0 };
```

And assign `protectedResources = protectedRes` inside the cargo block, then use `protectedResources` in the report.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/attack.handler.ts
git commit -m "feat(armored-storage): subtract protected resources from loot calculation"
```

---

### Task 5: Frontend — Protection indicator on Overview gauges

**Files:**
- Modify: `apps/web/src/pages/Overview.tsx`

- [ ] **Step 1: Add protected amount to ResourceGauge**

The `ResourceGauge` component (around line 32-62) renders an SVG circle. Add a second arc for the protected threshold.

Add `protectedAmount` to the props:

```typescript
function ResourceGauge({ current, capacity, rate, label, color, protectedAmount }: {
  current: number;
  capacity: number;
  rate: number;
  label: string;
  color: string;
  protectedAmount?: number;
})
```

Inside the SVG, after the main arc circle, add a dashed arc for the protection threshold:

```typescript
        {protectedAmount != null && protectedAmount > 0 && (
          <circle
            cx={33} cy={33} r={radius} fill="none" stroke="#22c55e" strokeWidth={2}
            strokeDasharray={`${(Math.min(100, (protectedAmount / capacity) * 100) / 100) * circumference} ${circumference}`}
            strokeDashoffset={0} strokeLinecap="round" opacity={0.5}
          />
        )}
```

Add a tooltip below the rate display:

```typescript
      {protectedAmount != null && protectedAmount > 0 && (
        <div className="text-[9px] text-green-500/70">🛡 {Math.floor(protectedAmount).toLocaleString('fr-FR')}</div>
      )}
```

- [ ] **Step 2: Calculate protected amounts and pass to gauges**

In the Overview page, after fetching `resourceData`, calculate the protected amounts. This requires knowing the storage levels and research level. The `resourceData.rates` already has `storageMineraiCapacity` etc. We need the `protected_storage_base_ratio` from gameConfig and the research level.

Use the existing `useGameConfig` hook and the research data. Add a query for the user's research level:

```typescript
const { data: gameConfig } = useGameConfig();
```

Calculate:
```typescript
const baseRatio = Number(gameConfig?.universe?.['protected_storage_base_ratio']) || 0.05;
const armoredLevel = /* from research data */ 0;
const armoredBonus = 1 + armoredLevel * 0.05; // simplified; or use resolveBonus client-side
const protectedMinerai = resourceData ? Math.floor(resourceData.rates.storageMineraiCapacity * baseRatio * armoredBonus) : 0;
const protectedSilicium = resourceData ? Math.floor(resourceData.rates.storageSiliciumCapacity * baseRatio * armoredBonus) : 0;
const protectedHydrogene = resourceData ? Math.floor(resourceData.rates.storageHydrogeneCapacity * baseRatio * armoredBonus) : 0;
```

The simplest approach: add the protected amounts to the `resource.production` tRPC response from the backend, so the frontend doesn't need to replicate the bonus calculation. Add `protectedMinerai`, `protectedSilicium`, `protectedHydrogene` fields to the production query response in `apps/api/src/modules/resource/resource.router.ts`.

Pass the values to each `ResourceGauge`:
```typescript
<ResourceGauge
  current={resources?.minerai ?? 0}
  capacity={resourceData?.rates.storageMineraiCapacity ?? 1}
  rate={resourceData?.rates.mineraiPerHour ?? 0}
  label="Minerai"
  color="#fb923c"
  protectedAmount={resourceData?.protectedMinerai}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Overview.tsx apps/api/src/modules/resource/resource.router.ts
git commit -m "feat(armored-storage): show protection indicator on Overview resource gauges"
```

---

### Task 6: Frontend — Armored capacity in building detail

**Files:**
- Modify: `apps/web/src/components/entity-details/BuildingDetailContent.tsx`

- [ ] **Step 1: Add armored capacity info for storage buildings**

In the BuildingDetailContent component, storage buildings already show a capacity progression table. Add a row showing the armored capacity.

After the storage capacity display, for buildings with role `storage_minerai`, `storage_silicium`, or `storage_hydrogene`, add:

```typescript
{(buildingRole === 'storage_minerai' || buildingRole === 'storage_silicium' || buildingRole === 'storage_hydrogene') && (
  <StatRow
    label="Capacité blindée"
    value={`${Math.floor(currentStorageCapacity * baseRatio * armoredBonus).toLocaleString('fr-FR')}`}
    tooltip="Cette quantité de ressources est protégée contre le pillage. Améliorez la recherche Blindage des hangars pour augmenter cette protection."
  />
)}
```

The exact integration depends on how `buildingRole` and storage capacity are available in the component. Read the file to determine the exact insertion point.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/entity-details/BuildingDetailContent.tsx
git commit -m "feat(armored-storage): show armored capacity in storage building details"
```

---

### Task 7: Frontend — Protected resources in combat report

**Files:**
- Modify: `apps/web/src/components/reports/CombatReportDetail.tsx`

- [ ] **Step 1: Show protected resources section**

In the combat report detail, after the pillage section, add:

```typescript
{report.result.protectedResources && (
  report.result.protectedResources.minerai > 0 ||
  report.result.protectedResources.silicium > 0 ||
  report.result.protectedResources.hydrogene > 0
) && (
  <div className="...">
    <h4>Ressources protégées</h4>
    {/* Show minerai, silicium, hydrogene amounts with shield icon and green styling */}
  </div>
)}
```

Style with green badges matching the existing pillage display but with a shield icon.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/reports/CombatReportDetail.tsx
git commit -m "feat(armored-storage): show protected resources in combat reports"
```

---

### Task 8: TypeScript verification

- [ ] **Step 1: Run TypeScript compilation**

```bash
cd packages/game-engine && npx tsc --noEmit
cd ../.. && cd apps/api && npx tsc --noEmit
cd ../web && npx tsc --noEmit
```

- [ ] **Step 2: Fix any errors and commit**

```bash
git add -A && git commit -m "fix(armored-storage): resolve TypeScript errors"
```
