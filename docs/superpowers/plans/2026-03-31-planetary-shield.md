# Planetary Shield Building Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old smallShield/largeShield defenses with a new planetary shield building that has levels, energy consumption, and special combat behavior (absorbs all damage, regenerates per round).

**Architecture:** 7 tasks: game-engine shield formulas (TDD), game-engine combat changes (TDD), DB schema + seed, API energy/percent/combat integration, frontend buildings+resources+defense pages, migration script for existing players.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, tRPC, React, Tailwind CSS

---

### Task 1: Game-engine shield formulas + tests

**Files:**
- Create: `packages/game-engine/src/formulas/shield.ts`
- Create: `packages/game-engine/src/formulas/shield.test.ts`
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Create test file**

Create `packages/game-engine/src/formulas/shield.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateShieldCapacity, calculateShieldEnergy } from './shield.js';

describe('calculateShieldCapacity', () => {
  it('returns 30 at level 1', () => {
    expect(calculateShieldCapacity(1)).toBe(30);
  });

  it('returns 39 at level 2', () => {
    expect(calculateShieldCapacity(2)).toBe(39);
  });

  it('returns 318 at level 10', () => {
    expect(calculateShieldCapacity(10)).toBe(318);
  });

  it('returns 0 at level 0', () => {
    expect(calculateShieldCapacity(0)).toBe(0);
  });
});

describe('calculateShieldEnergy', () => {
  it('returns 30 at level 1', () => {
    expect(calculateShieldEnergy(1)).toBe(30);
  });

  it('returns 45 at level 2', () => {
    expect(calculateShieldEnergy(2)).toBe(45);
  });

  it('returns 1154 at level 10', () => {
    expect(calculateShieldEnergy(10)).toBe(1154);
  });

  it('returns 0 at level 0', () => {
    expect(calculateShieldEnergy(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/game-engine && npx vitest run src/formulas/shield.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement shield formulas**

Create `packages/game-engine/src/formulas/shield.ts`:

```ts
/**
 * Planetary shield capacity based on building level.
 * Formula: floor(30 * 1.3^(level-1))
 */
export function calculateShieldCapacity(level: number): number {
  if (level <= 0) return 0;
  return Math.floor(30 * Math.pow(1.3, level - 1));
}

/**
 * Planetary shield energy consumption at 100% power.
 * Formula: floor(30 * 1.5^(level-1))
 */
export function calculateShieldEnergy(level: number): number {
  if (level <= 0) return 0;
  return Math.floor(30 * Math.pow(1.5, level - 1));
}
```

- [ ] **Step 4: Export from index**

Add to `packages/game-engine/src/index.ts`:

```ts
export * from './formulas/shield.js';
```

- [ ] **Step 5: Run tests**

Run: `cd packages/game-engine && npx vitest run src/formulas/shield.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/shield.ts packages/game-engine/src/formulas/shield.test.ts packages/game-engine/src/index.ts
git commit -m "feat(game-engine): add planetary shield capacity and energy formulas"
```

---

### Task 2: Game-engine combat — new targeting order with shield

**Files:**
- Modify: `packages/game-engine/src/formulas/combat.ts`
- Modify: `packages/game-engine/src/formulas/combat.test.ts` (if exists, else create)

The combat system must support a new targeting order: fleet (light→medium→heavy) → shield → defenses → support/utilitaires.

The planetary shield is a special unit:
- 0 hull (cannot be destroyed — skip the hull damage check)
- 0 weapons, 0 shotCount (never fires)
- shield = capacity * powerPercent (regenerates full each round)
- Category: `'shield'` — targeted after fleet categories but before defenses

- [ ] **Step 1: Add `planetaryShield` to CombatInput**

In `packages/game-engine/src/formulas/combat.ts`, add an optional field to the `CombatInput` interface:

```ts
  /** Planetary shield: capacity based on building level * power percent. 0 = no shield. */
  planetaryShieldCapacity?: number;
```

- [ ] **Step 2: Modify `simulateCombat` to inject shield unit**

In the `simulateCombat` function, after `const defenders = [...]` (line 301), add the shield injection:

```ts
  // Inject planetary shield as a special defender unit
  if (input.planetaryShieldCapacity && input.planetaryShieldCapacity > 0) {
    defenders.push({
      id: 'planetary-shield-0',
      shipType: '__planetaryShield__',
      category: 'shield',
      shield: input.planetaryShieldCapacity,
      maxShield: input.planetaryShieldCapacity,
      armor: 0,
      hull: Infinity, // Cannot be destroyed
      maxHull: Infinity,
      weaponDamage: 0,
      shotCount: 0,
      destroyed: false,
    });
  }
```

- [ ] **Step 3: Modify `selectTarget` to respect new ordering**

The current `selectTarget` follows category targetOrder. We need the shield category to be targeted after fleet but before defenses. This is handled by the `ShipCategory` array in `COMBAT_CATEGORIES`. Add a new category in `packages/game-engine/src/formulas/combat-config.ts`:

In the `COMBAT_CATEGORIES` array, add shield between heavy (targetOrder 3) and support (targetOrder 4):

```ts
export const COMBAT_CATEGORIES: ShipCategory[] = [
  { id: 'light', name: 'Léger', targetable: true, targetOrder: 1 },
  { id: 'medium', name: 'Moyen', targetable: true, targetOrder: 2 },
  { id: 'heavy', name: 'Lourd', targetable: true, targetOrder: 3 },
  { id: 'shield', name: 'Bouclier', targetable: true, targetOrder: 4 },
  { id: 'defense', name: 'Défense', targetable: true, targetOrder: 5 },
  { id: 'support', name: 'Support', targetable: false, targetOrder: 6 },
];
```

Wait — currently defenses don't have their own category. They use `heavy`, `medium`, `light` etc from the `combatCategoryId` config. The targeting is by category, not by unit type. We need defenses to have a `'defense'` category so they're targeted after the shield.

This is a bigger change. Let me reconsider: the spec says the targeting order is Fleet(light→medium→heavy) → Shield → Defenses → Support. Currently defenses use the same categories as ships (light/medium/heavy). To make defenses targeted after shield, we need to assign them a separate category.

In `buildShipCombatConfigs` (fleet.types.ts), defenses are assigned `categoryId: def.combatCategoryId ?? 'heavy'`. To change the targeting order, we should override defense categories to `'defense'` when building the combat input.

- [ ] **Step 4: Override defense categories in attack handler**

In the attack handler, after building `shipCombatConfigs`, override defense unit categories:

In `apps/api/src/modules/fleet/handlers/attack.handler.ts`, after `const shipCombatConfigs = buildShipCombatConfigs(config);` add:

```ts
    // Override defense categories for new targeting order: fleet → shield → defenses → support
    for (const defId of defenseIdSet) {
      if (shipCombatConfigs[defId]) {
        shipCombatConfigs[defId] = { ...shipCombatConfigs[defId], categoryId: 'defense' };
      }
    }
```

- [ ] **Step 5: Modify hull/destruction check for shield unit**

In the `fireShot` function in `combat.ts`, the unit is destroyed when `hull <= 0`. For the planetary shield (hull = Infinity), this never happens. The shield just absorbs damage to its shield pool. This works automatically since `Infinity > 0` is always true. No code change needed.

- [ ] **Step 6: Exclude planetary shield from losses/debris**

In `simulateCombat`, after the combat loop, the shield unit should be excluded from `defenderLosses` and `debris` calculations. In `countDestroyedByType` and `calculateDebris`, the `__planetaryShield__` type should be skipped.

After the combat loop, before calculating losses:

```ts
  // Remove shield unit from defenders before counting losses (it's not destroyable)
  const realDefenders = defenders.filter(u => u.shipType !== '__planetaryShield__');
```

Use `realDefenders` instead of `defenders` for loss/debris calculation.

- [ ] **Step 7: Add shield damage to RoundResult**

Add `shieldAbsorbed?: number` to the `RoundResult` interface so reports can show how much the shield absorbed per round.

- [ ] **Step 8: Write combat tests for shield behavior**

Add tests to verify:
- Shield absorbs damage before defenses
- Shield regenerates each round
- If shield is overwhelmed in one round, excess damage passes to defenses
- Shield with 0 capacity doesn't participate
- Shield never appears in losses or debris

- [ ] **Step 9: Run all tests**

Run: `cd packages/game-engine && npx vitest run`
Expected: ALL PASS

- [ ] **Step 10: Commit**

```bash
git add packages/game-engine/
git commit -m "feat(game-engine): planetary shield in combat with new targeting order"
```

---

### Task 3: DB schema changes + seed config

**Files:**
- Modify: `packages/db/src/schema/planets.ts` — add `shieldPercent` column
- Modify: `packages/db/src/schema/planet-defenses.ts` — remove `smallShield`, `largeShield` columns
- Modify: `packages/db/src/seed-game-config.ts` — add `planetaryShield` building, remove shield defenses

- [ ] **Step 1: Add `shieldPercent` to planets schema**

In `packages/db/src/schema/planets.ts`, after the existing percent columns (line ~31), add:

```ts
  shieldPercent: smallint('shield_percent').notNull().default(100),
```

- [ ] **Step 2: Remove shield columns from planet-defenses**

In `packages/db/src/schema/planet-defenses.ts`, remove the `smallShield` and `largeShield` columns.

- [ ] **Step 3: Add `planetaryShield` building to seed**

In `packages/db/src/seed-game-config.ts`, add to the BUILDINGS array:

```ts
  { id: 'planetaryShield', name: 'Bouclier planétaire', description: 'Génère un champ de force protégeant la planète. Sa puissance est réglable pour économiser l\'énergie.', baseCostMinerai: 2000, baseCostSilicium: 2000, baseCostHydrogene: 0, costFactor: 1.5, baseTime: 7200, categoryId: 'building_defense', sortOrder: 20, role: 'planetaryShield', flavorText: "Un dôme d'énergie pure enveloppe la planète, absorbant les assauts ennemis tant que son générateur est alimenté.", prerequisites: { buildings: [], research: [{ researchId: 'armor', level: 1 }, { researchId: 'shielding', level: 1 }] } },
```

- [ ] **Step 4: Remove `smallShield` and `largeShield` from DEFENSES array**

Remove the two entries from the DEFENSES array in seed-game-config.ts.

- [ ] **Step 5: Build**

Run: `pnpm build`

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add planetary shield building, remove old shield defenses"
```

---

### Task 4: API — shield energy consumption in production rates

**Files:**
- Modify: `packages/game-engine/src/formulas/resources.ts` — add shield to PlanetLevels, ProductionRates, calculateProductionRates
- Modify: `apps/api/src/modules/resource/resource.service.ts` — pass shield data

- [ ] **Step 1: Add shield fields to PlanetLevels and ProductionRates**

In `packages/game-engine/src/formulas/resources.ts`:

Add to `PlanetLevels` interface:
```ts
  planetaryShieldLevel?: number;
  shieldPercent?: number;
```

Add to `ProductionRates` interface:
```ts
  shieldEnergyConsumption: number;
  shieldPercent: number;
```

- [ ] **Step 2: Add shield energy to calculateProductionRates**

In the `calculateProductionRates` function, import `calculateShieldEnergy` from `'./shield.js'`.

After the hydrogen energy calculation (line ~102), add:

```ts
  const shieldPct = (planet.shieldPercent ?? 100) / 100;
  const shieldEnergy = Math.floor(calculateShieldEnergy(planet.planetaryShieldLevel ?? 0) * shieldPct);
```

Update `energyConsumed` to include shield:

```ts
  const energyConsumed = mineraiEnergy + siliciumEnergy + hydrogeneEnergy + shieldEnergy;
```

Add to the return object:
```ts
    shieldEnergyConsumption: shieldEnergy,
    shieldPercent: planet.shieldPercent ?? 100,
```

- [ ] **Step 3: Pass shield data from resource service**

In `apps/api/src/modules/resource/resource.service.ts`, where `PlanetLevels` is built, add `planetaryShieldLevel` from building levels and `shieldPercent` from the planet row.

- [ ] **Step 4: Add endpoint to update shieldPercent**

In the resource router (or building router), add a mutation to update `shieldPercent` on the planets table, following the same pattern as `setProductionPercent`.

- [ ] **Step 5: Build and test**

Run: `pnpm build && cd packages/game-engine && npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/ apps/api/
git commit -m "feat(api): shield energy consumption in production rates + shieldPercent endpoint"
```

---

### Task 5: API — inject planetary shield into combat

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/attack.handler.ts`
- Modify: `apps/api/src/modules/fleet/combat.helpers.ts` (if needed)

- [ ] **Step 1: Fetch shield level and calculate capacity**

In `attack.handler.ts`, after fetching defender planet data, get the shield building level:

```ts
    const defenderBuildingLevels = await getBuildingLevels(ctx.db, targetPlanet.id);
    const shieldLevel = defenderBuildingLevels['planetaryShield'] ?? 0;
    const shieldPercent = targetPlanet.shieldPercent ?? 100;
    const planetaryShieldCapacity = Math.floor(calculateShieldCapacity(shieldLevel) * (shieldPercent / 100));
```

- [ ] **Step 2: Pass to combat input**

Add `planetaryShieldCapacity` to the `CombatInput`:

```ts
    const combatInput: CombatInput = {
      ...existing fields,
      planetaryShieldCapacity,
    };
```

- [ ] **Step 3: Override defense categories**

After building `shipCombatConfigs`, override defense categories to `'defense'`:

```ts
    for (const defId of defenseIdSet) {
      if (shipCombatConfigs[defId]) {
        shipCombatConfigs[defId] = { ...shipCombatConfigs[defId], categoryId: 'defense' };
      }
    }
```

- [ ] **Step 4: Add shield info to combat report**

In the report building section, add planetary shield data to the result payload:

```ts
    if (shieldLevel > 0) {
      reportResult.planetaryShield = { level: shieldLevel, capacity: planetaryShieldCapacity };
    }
```

- [ ] **Step 5: Build**

Run: `pnpm build`

- [ ] **Step 6: Commit**

```bash
git add apps/api/
git commit -m "feat(api): inject planetary shield into combat with new targeting order"
```

---

### Task 6: Frontend — shield building + energy slider + defense cleanup

**Files:**
- Modify: `apps/web/src/pages/Buildings.tsx` — shield appears as building with stats
- Modify: `apps/web/src/pages/Resources.tsx` — add shield power slider
- Modify: `apps/web/src/pages/Defense.tsx` — remove old shields

- [ ] **Step 1: Shield building in Buildings page**

The planetary shield building should appear automatically via `trpc.building.list` since it's now in the buildings config. Add a production stat display for it showing shield capacity and energy consumption at current level.

In `Buildings.tsx`, in the `getProductionStats` function (or equivalent), add a case for `planetaryShield`:

```ts
  if (buildingId === 'planetaryShield') {
    return {
      label: `Bouclier : ${calculateShieldCapacity(level)} pts`,
      energyLabel: `${calculateShieldEnergy(level)} énergie`,
    };
  }
```

- [ ] **Step 2: Add shield power slider to Resources page**

In `Resources.tsx`, after the existing mine percent sliders, add a shield section:

```tsx
{/* Shield power slider */}
{shieldLevel > 0 && (
  <div className="glass-card p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">Bouclier planétaire (niv. {shieldLevel})</h3>
      <span className="text-xs text-muted-foreground">{shieldPercent}%</span>
    </div>
    <input
      type="range"
      min={0}
      max={100}
      step={10}
      value={shieldPercent}
      onChange={(e) => handleShieldPercentChange(Number(e.target.value))}
      className="w-full"
    />
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>Bouclier : {Math.floor(calculateShieldCapacity(shieldLevel) * shieldPercent / 100)} pts</span>
      <span>Énergie : {Math.floor(calculateShieldEnergy(shieldLevel) * shieldPercent / 100)}</span>
    </div>
  </div>
)}
```

The `handleShieldPercentChange` calls the new `setShieldPercent` mutation.

- [ ] **Step 3: Remove old shields from Defense page**

In `Defense.tsx`, the old `smallShield` and `largeShield` should no longer appear since they've been removed from the config. Verify the page still works without them. If there's any hardcoded reference to `defense_boucliers` category, remove it.

- [ ] **Step 4: Build**

Run: `pnpm build`

- [ ] **Step 5: Commit**

```bash
git add apps/web/
git commit -m "feat(web): planetary shield building, energy slider, remove old shield defenses"
```

---

### Task 7: Migration script for existing players

**Files:**
- Create: `packages/db/src/scripts/migrate-shields.ts`

- [ ] **Step 1: Write migration script**

Create `packages/db/src/scripts/migrate-shields.ts`:

```ts
/**
 * Migration: convert old smallShield/largeShield defenses to new planetaryShield building.
 * - Player with smallShield=1 → planetaryShield level 1
 * - Player with largeShield=1 → planetaryShield level 3
 * - Player with both → planetaryShield level 3
 *
 * Run: npx tsx packages/db/src/scripts/migrate-shields.ts
 */
import { createDb } from '../connection.js';
import { planetDefenses, planetBuildings } from '../schema/index.js';
import { eq, or, gt } from 'drizzle-orm';

async function main() {
  const db = createDb();

  // Find all planets with old shields
  const planetsWithShields = await db
    .select({
      planetId: planetDefenses.planetId,
      smallShield: planetDefenses.smallShield,
      largeShield: planetDefenses.largeShield,
    })
    .from(planetDefenses)
    .where(or(gt(planetDefenses.smallShield, 0), gt(planetDefenses.largeShield, 0)));

  console.log(`Found ${planetsWithShields.length} planets with old shields`);

  for (const planet of planetsWithShields) {
    const level = planet.largeShield > 0 ? 3 : 1;

    // Upsert building
    const [existing] = await db
      .select()
      .from(planetBuildings)
      .where(
        eq(planetBuildings.planetId, planet.planetId) &&
        eq(planetBuildings.buildingId, 'planetaryShield'),
      )
      .limit(1);

    if (existing) {
      if (existing.level < level) {
        await db.update(planetBuildings)
          .set({ level })
          .where(eq(planetBuildings.id, existing.id));
      }
    } else {
      await db.insert(planetBuildings).values({
        planetId: planet.planetId,
        buildingId: 'planetaryShield',
        level,
      });
    }

    console.log(`Planet ${planet.planetId}: shield level ${level}`);
  }

  console.log('Migration complete');
  process.exit(0);
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/scripts/migrate-shields.ts
git commit -m "feat(db): migration script to convert old shield defenses to new building"
```
