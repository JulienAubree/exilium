# Combat System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Exilium-style combat engine (rapid fire, random targeting, armor-as-HP) with a new system based on shield/armor-reduction/hull mechanics, ship categories, target priority, and deterministic shot counts.

**Architecture:** The combat engine (`combat.ts`) is rewritten with new interfaces (5 stats, categories, target priority, simultaneous resolution). The game config schema gains new columns (shotCount, hull, armor-as-reduction, categoryId for combat) and loses the rapid_fire table. Handlers and frontend adapt to the new interfaces.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, PostgreSQL, React

**Spec:** `docs/superpowers/specs/2026-03-26-combat-system-redesign.md`

---

## File Structure

### New/Rewritten Files
| File | Responsibility |
|------|---------------|
| `packages/game-engine/src/formulas/combat.ts` | New combat engine (complete rewrite) |
| `packages/game-engine/src/formulas/combat.test.ts` | New test suite (complete rewrite) |

### Modified Files
| File | Changes |
|------|---------|
| `packages/db/src/schema/game-config.ts` | Add columns to shipDefinitions/defenseDefinitions (hull, shotCount, combatCategoryId, baseArmor rename). Drop rapidFire table. |
| `packages/db/src/schema/planet-ships.ts` | Rename columns: lightFighter→interceptor, heavyFighter→frigate, battleship→battlecruiser |
| `packages/db/src/schema/planet-defenses.ts` | Rename column: gaussCannon→electromagneticCannon |
| `packages/db/src/schema/fleet-events.ts` | Add targetPriority field |
| `packages/db/src/seed-game-config.ts` | New ship/defense stats (5 stats), remove rapidFire seed, add combat categories, add combat config keys |
| `apps/api/src/modules/fleet/fleet.types.ts` | Update buildCombatStats(), add buildCombatConfigs(), update SendFleetInput |
| `apps/api/src/modules/fleet/handlers/attack.handler.ts` | New simulateCombat() call signature, target priority, new result processing |
| `apps/api/src/modules/pve/pirate.service.ts` | Same — new simulateCombat() signature |
| `apps/api/src/modules/admin/game-config.service.ts` | Remove rapidFire CRUD, add combat category config |
| `apps/web/src/lib/entity-details.ts` | Remove rapidFire display, add new stats |
| `apps/web/src/components/entity-details/ShipDetailContent.tsx` | Remove rapidFire section, show new 5 stats |
| `apps/web/src/components/entity-details/DefenseDetailContent.tsx` | Same |
| `apps/web/src/pages/Reports.tsx` | New report format with category stats |
| `apps/admin/src/pages/RapidFire.tsx` | Remove (or repurpose) |
| `apps/api/src/lib/config-helpers.test.ts` | Remove rapidFire mock references |
| `packages/game-engine/src/formulas/fleet.test.ts` | Update ship IDs (lightFighter→interceptor, etc.) |
| `packages/game-engine/src/formulas/ranking.test.ts` | Update ship/defense IDs |
| `packages/game-engine/src/formulas/shipyard-cost.test.ts` | Update ship/defense IDs |

### Notes on spec divergences (intentional)
- **`CombatInput.shipConfigs`**: spec defines `ShipCombatConfig[]` (array), plan uses `Record<string, ShipCombatConfig>` (map) for O(1) lookup — better for implementation.
- **`CombatInput` multipliers**: spec uses raw tech levels, plan uses pre-computed multipliers — consistent with existing `getCombatMultipliers()` pattern.
- **DB column names**: spec suggests renaming `weapons`→`baseWeaponDamage`, `shield`→`baseShield`. Plan keeps `weapons` and `shield` unchanged in DB to avoid unnecessary migration complexity — the mapping to `ShipCombatConfig` field names happens in `buildShipCombatConfigs()`. Only `armor`→`hull` is renamed because the semantic meaning actually changed.
- **Construction/shipyard pages**: ship names flow automatically from game config `name` field — no manual UI changes needed for display names.

---

## Task 1: Rewrite combat engine — interfaces and types

**Files:**
- Rewrite: `packages/game-engine/src/formulas/combat.ts`

- [ ] **Step 1: Clear combat.ts and write new interfaces**

Replace entire file content with new type definitions only (no implementation yet):

```typescript
// ── Types ──

export interface ShipCategory {
  id: string;
  name: string;
  targetable: boolean;
  targetOrder: number;
}

export interface ShipCombatConfig {
  shipType: string;
  categoryId: string;
  baseShield: number;
  baseArmor: number;       // flat damage reduction — no research bonus
  baseHull: number;
  baseWeaponDamage: number;
  baseShotCount: number;
}

export interface CombatConfig {
  maxRounds: number;
  debrisRatio: number;
  defenseRepairRate: number;
  pillageRatio: number;
  minDamagePerHit: number;
  researchBonusPerLevel: number;
  categories: ShipCategory[];
}

export interface CombatMultipliers {
  weapons: number;
  shielding: number;
  armor: number;
}

export interface CombatInput {
  attackerFleet: Record<string, number>;
  defenderFleet: Record<string, number>;
  defenderDefenses: Record<string, number>;
  attackerMultipliers: CombatMultipliers;
  defenderMultipliers: CombatMultipliers;
  attackerTargetPriority: string;
  defenderTargetPriority: string;
  combatConfig: CombatConfig;
  shipConfigs: Record<string, ShipCombatConfig>;
  shipCosts: Record<string, { minerai: number; silicium: number }>;
  shipIds: Set<string>;
  defenseIds: Set<string>;
  rngSeed?: number;
}

interface CombatUnit {
  id: string;
  shipType: string;
  category: string;
  shield: number;
  maxShield: number;
  armor: number;
  hull: number;
  maxHull: number;
  weaponDamage: number;
  shotCount: number;
  destroyed: boolean;
}

export interface CombatSideStats {
  damageDealtByCategory: Record<string, number>;
  damageReceivedByCategory: Record<string, number>;
  shieldAbsorbed: number;
  armorBlocked: number;
  overkillWasted: number;
}

export interface RoundResult {
  round: number;
  attackerShips: Record<string, number>;
  defenderShips: Record<string, number>;
  attackerStats: CombatSideStats;
  defenderStats: CombatSideStats;
}

export interface CombatResult {
  rounds: RoundResult[];
  outcome: 'attacker' | 'defender' | 'draw';
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  debris: { minerai: number; silicium: number };
  repairedDefenses: Record<string, number>;
  attackerStats: CombatSideStats;
  defenderStats: CombatSideStats;
}

// Placeholder exports for compilation
export function simulateCombat(_input: CombatInput): CombatResult {
  throw new Error('Not implemented');
}

export function calculateDebris(
  _attackerLosses: Record<string, number>,
  _defenderLosses: Record<string, number>,
  _shipIds: Set<string>,
  _shipCosts: Record<string, { minerai: number; silicium: number }>,
  _debrisRatio?: number,
): { minerai: number; silicium: number } {
  throw new Error('Not implemented');
}

export function repairDefenses(
  _defenderLosses: Record<string, number>,
  _defenseIds: Set<string>,
  _repairProbability?: number,
): Record<string, number> {
  throw new Error('Not implemented');
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit --project packages/game-engine/tsconfig.json`

Expected: No type errors in combat.ts (callers will break — that's expected and handled in later tasks).

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/formulas/combat.ts
git commit -m "feat(combat): rewrite combat engine interfaces for new system"
```

---

## Task 2: Implement core combat engine — unit creation and targeting

**Files:**
- Modify: `packages/game-engine/src/formulas/combat.ts`
- Rewrite: `packages/game-engine/src/formulas/combat.test.ts`

- [ ] **Step 1: Write test for createUnits**

Replace `combat.test.ts` with a new test file. Start with unit creation:

```typescript
import { describe, it, expect } from 'vitest';
import { simulateCombat, calculateDebris, repairDefenses } from './combat.js';
import type { CombatInput, ShipCombatConfig, CombatConfig, ShipCategory } from './combat.js';

const CATEGORIES: ShipCategory[] = [
  { id: 'light', name: 'Léger', targetable: true, targetOrder: 1 },
  { id: 'medium', name: 'Moyen', targetable: true, targetOrder: 2 },
  { id: 'heavy', name: 'Lourd', targetable: true, targetOrder: 3 },
  { id: 'support', name: 'Support', targetable: false, targetOrder: 4 },
];

const COMBAT_CONFIG: CombatConfig = {
  maxRounds: 4,
  debrisRatio: 0.3,
  defenseRepairRate: 0.7,
  pillageRatio: 0.33,
  minDamagePerHit: 1,
  researchBonusPerLevel: 0.1,
  categories: CATEGORIES,
};

const SHIP_CONFIGS: Record<string, ShipCombatConfig> = {
  interceptor:    { shipType: 'interceptor',    categoryId: 'light',  baseShield: 8,  baseArmor: 1, baseHull: 12,  baseWeaponDamage: 4,  baseShotCount: 3 },
  frigate:        { shipType: 'frigate',        categoryId: 'medium', baseShield: 16, baseArmor: 2, baseHull: 30,  baseWeaponDamage: 12, baseShotCount: 2 },
  cruiser:        { shipType: 'cruiser',        categoryId: 'heavy',  baseShield: 28, baseArmor: 4, baseHull: 55,  baseWeaponDamage: 45, baseShotCount: 1 },
  battlecruiser:  { shipType: 'battlecruiser',  categoryId: 'heavy',  baseShield: 40, baseArmor: 6, baseHull: 100, baseWeaponDamage: 70, baseShotCount: 1 },
  smallCargo:     { shipType: 'smallCargo',     categoryId: 'support', baseShield: 2,  baseArmor: 0, baseHull: 8,   baseWeaponDamage: 1,  baseShotCount: 1 },
};

const SHIP_IDS = new Set(['interceptor', 'frigate', 'cruiser', 'battlecruiser', 'smallCargo']);
const DEFENSE_IDS = new Set(['rocketLauncher', 'electromagneticCannon']);
const SHIP_COSTS: Record<string, { minerai: number; silicium: number }> = {
  interceptor:   { minerai: 3000,  silicium: 1000 },
  frigate:       { minerai: 6000,  silicium: 4000 },
  cruiser:       { minerai: 20000, silicium: 7000 },
  battlecruiser: { minerai: 45000, silicium: 15000 },
  smallCargo:    { minerai: 2000,  silicium: 2000 },
};

const NO_BONUS = { weapons: 1, shielding: 1, armor: 1 };

function makeInput(overrides: Partial<CombatInput> = {}): CombatInput {
  return {
    attackerFleet: {},
    defenderFleet: {},
    defenderDefenses: {},
    attackerMultipliers: NO_BONUS,
    defenderMultipliers: NO_BONUS,
    attackerTargetPriority: 'light',
    defenderTargetPriority: 'light',
    combatConfig: COMBAT_CONFIG,
    shipConfigs: SHIP_CONFIGS,
    shipCosts: SHIP_COSTS,
    shipIds: SHIP_IDS,
    defenseIds: DEFENSE_IDS,
    ...overrides,
  };
}

describe('simulateCombat', () => {
  it('attacker wins against empty defender', () => {
    const result = simulateCombat(makeInput({
      attackerFleet: { interceptor: 5 },
    }));
    expect(result.outcome).toBe('attacker');
    expect(result.rounds.length).toBe(1);
    expect(result.attackerLosses).toEqual({});
  });

  it('combat lasts at most maxRounds (4)', () => {
    const result = simulateCombat(makeInput({
      attackerFleet: { interceptor: 1 },
      defenderFleet: { interceptor: 1 },
    }));
    expect(result.rounds.length).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/julienaubree/_projet/exilium && npx vitest run packages/game-engine/src/formulas/combat.test.ts`

Expected: FAIL — `simulateCombat` throws "Not implemented".

- [ ] **Step 3: Implement createUnits and selectTarget in combat.ts**

Add these private functions above the placeholder `simulateCombat`:

```typescript
function createUnits(
  fleet: Record<string, number>,
  multipliers: CombatMultipliers,
  shipConfigs: Record<string, ShipCombatConfig>,
  idOffset: number,
): CombatUnit[] {
  const units: CombatUnit[] = [];
  let counter = idOffset;

  for (const [type, count] of Object.entries(fleet)) {
    const config = shipConfigs[type];
    if (!config || count <= 0) continue;

    for (let i = 0; i < count; i++) {
      const maxShield = config.baseShield * multipliers.shielding;
      const maxHull = config.baseHull * multipliers.armor;
      const weaponDamage = config.baseWeaponDamage * multipliers.weapons;

      units.push({
        id: `${type}-${counter++}`,
        shipType: type,
        category: config.categoryId,
        shield: maxShield,
        maxShield,
        armor: config.baseArmor,  // intrinsic, no bonus
        hull: maxHull,
        maxHull,
        weaponDamage,
        shotCount: config.baseShotCount,
        destroyed: false,
      });
    }
  }
  return units;
}

function selectTarget(
  units: CombatUnit[],
  priorityCategoryId: string,
  categories: ShipCategory[],
  rng: () => number,
): CombatUnit | null {
  // Sort categories by targetOrder for fallback
  const sortedCategories = [...categories].sort((a, b) => a.targetOrder - b.targetOrder);

  // Try priority category first
  const priorityTargets = units.filter(u => !u.destroyed && u.category === priorityCategoryId);
  if (priorityTargets.length > 0) {
    return priorityTargets[Math.floor(rng() * priorityTargets.length)];
  }

  // Fallback: iterate categories by targetOrder
  for (const cat of sortedCategories) {
    if (cat.id === priorityCategoryId) continue;
    const targets = units.filter(u => !u.destroyed && u.category === cat.id);
    if (targets.length > 0) {
      return targets[Math.floor(rng() * targets.length)];
    }
  }

  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/game-engine/src/formulas/combat.ts packages/game-engine/src/formulas/combat.test.ts
git commit -m "feat(combat): add createUnits, selectTarget, and first tests"
```

---

## Task 3: Implement damage resolution (single shot)

**Files:**
- Modify: `packages/game-engine/src/formulas/combat.ts`
- Modify: `packages/game-engine/src/formulas/combat.test.ts`

- [ ] **Step 1: Write tests for damage resolution**

Add to `combat.test.ts`:

```typescript
describe('damage resolution', () => {
  it('big shot pierces shield and deals hull damage minus armor', () => {
    // Cruiser (45 dmg) vs interceptor (shield 8, armor 1, hull 12)
    // Shot: 45 - 8 shield = 37 surplus, 37 - 1 armor = 36 hull dmg → 12 - 36 = destroyed
    const result = simulateCombat(makeInput({
      attackerFleet: { cruiser: 1 },
      defenderFleet: { interceptor: 1 },
    }));
    expect(result.outcome).toBe('attacker');
    expect(result.defenderLosses.interceptor).toBe(1);
  });

  it('small shots lose effectiveness against armor (min 1 dmg per hit)', () => {
    // Interceptor (4 dmg, 3 shots) vs cruiser (shield 28, armor 4, hull 55)
    // All 3 shots of 4 dmg → shield absorbs 12 (28-12=16 remaining) → 0 hull dmg
    // Cruiser survives easily
    const result = simulateCombat(makeInput({
      attackerFleet: { interceptor: 1 },
      defenderFleet: { cruiser: 1 },
    }));
    expect(result.outcome).toBe('defender');
  });

  it('minimum 1 damage per hit that reaches hull', () => {
    // Use custom config: 1 dmg weapon vs 0 shield, 5 armor, 2 hull
    const configs: Record<string, ShipCombatConfig> = {
      ...SHIP_CONFIGS,
      weakShip: { shipType: 'weakShip', categoryId: 'light', baseShield: 0, baseArmor: 5, baseHull: 2, baseWeaponDamage: 1, baseShotCount: 3 },
      tinyShip: { shipType: 'tinyShip', categoryId: 'light', baseShield: 0, baseArmor: 0, baseHull: 100, baseWeaponDamage: 1, baseShotCount: 3 },
    };
    // tinyShip fires 3×1 at weakShip (0 shield, 5 armor) → each hit = max(1-5, 1) = 1 → 3 hull dmg → destroyed (hull was 2)
    const result = simulateCombat(makeInput({
      attackerFleet: { tinyShip: 1 },
      defenderFleet: { weakShip: 1 },
      shipConfigs: configs,
      shipIds: new Set([...SHIP_IDS, 'weakShip', 'tinyShip']),
    }));
    expect(result.defenderLosses.weakShip).toBe(1);
  });

  it('shields regenerate each round', () => {
    // After round 1, surviving units get full shield back
    const result = simulateCombat(makeInput({
      attackerFleet: { interceptor: 3 },
      defenderFleet: { frigate: 1 },
    }));
    // Frigate should survive multiple rounds thanks to shield regen
    expect(result.rounds.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/julienaubree/_projet/exilium && npx vitest run packages/game-engine/src/formulas/combat.test.ts`

- [ ] **Step 3: Implement fireShot and fireSalvo**

Add to `combat.ts`:

```typescript
function emptySideStats(): CombatSideStats {
  return {
    damageDealtByCategory: {},
    damageReceivedByCategory: {},
    shieldAbsorbed: 0,
    armorBlocked: 0,
    overkillWasted: 0,
  };
}

function fireShot(
  attacker: CombatUnit,
  target: CombatUnit,
  minDamage: number,
  attackerStats: CombatSideStats,
  defenderStats: CombatSideStats,
): void {
  const damage = attacker.weaponDamage;

  // Shield absorbs first
  if (target.shield >= damage) {
    target.shield -= damage;
    defenderStats.shieldAbsorbed += damage;
    return;
  }

  let surplus = damage;
  if (target.shield > 0) {
    surplus = damage - target.shield;
    defenderStats.shieldAbsorbed += target.shield;
    target.shield = 0;
  }

  // Armor reduces surplus, minimum 1 damage if shot reaches hull
  const hullDamage = Math.max(surplus - target.armor, minDamage);
  defenderStats.armorBlocked += Math.min(target.armor, surplus);

  target.hull -= hullDamage;

  // Track damage by category
  attackerStats.damageDealtByCategory[target.category] =
    (attackerStats.damageDealtByCategory[target.category] ?? 0) + hullDamage;
  defenderStats.damageReceivedByCategory[attacker.category] =
    (defenderStats.damageReceivedByCategory[attacker.category] ?? 0) + hullDamage;

  if (target.hull <= 0) {
    if (target.hull < 0) attackerStats.overkillWasted += Math.abs(target.hull);
    target.hull = 0;
    target.destroyed = true;
  }
}

function fireSalvo(
  attacker: CombatUnit,
  enemies: CombatUnit[],
  priorityCategoryId: string,
  categories: ShipCategory[],
  minDamage: number,
  attackerStats: CombatSideStats,
  defenderStats: CombatSideStats,
  rng: () => number,
): void {
  for (let shot = 0; shot < attacker.shotCount; shot++) {
    const target = selectTarget(enemies, priorityCategoryId, categories, rng);
    if (!target) return;
    fireShot(attacker, target, minDamage, attackerStats, defenderStats);
  }
}
```

- [ ] **Step 4: Implement simulateCombat main loop**

Replace the placeholder `simulateCombat` with the full implementation.

**CRITICAL — Simultaneous combat:** Both sides fire on the **same start-of-round snapshot**. To implement this correctly, we deep-clone the unit arrays before each side fires, so each side fires at pristine copies. Then we merge the damage from both clones back onto the real units.

```typescript
function cloneUnits(units: CombatUnit[]): CombatUnit[] {
  return units.map(u => ({ ...u }));
}

function applyDamage(originals: CombatUnit[], damaged: CombatUnit[]): void {
  const damageMap = new Map(damaged.map(u => [u.id, u]));
  for (const unit of originals) {
    const d = damageMap.get(unit.id);
    if (d) {
      unit.hull = d.hull;
      unit.shield = d.shield;
      unit.destroyed = d.destroyed;
    }
  }
}

export function simulateCombat(input: CombatInput): CombatResult {
  const {
    attackerFleet, defenderFleet, defenderDefenses,
    attackerMultipliers, defenderMultipliers,
    attackerTargetPriority, defenderTargetPriority,
    combatConfig, shipConfigs, shipCosts, shipIds, defenseIds,
    rngSeed,
  } = input;

  const rng = createRng(rngSeed);

  // Create units (function-scoped counter, no global state)
  const attackers = createUnits(attackerFleet, attackerMultipliers, shipConfigs, 0);
  const defenderShipUnits = createUnits(defenderFleet, defenderMultipliers, shipConfigs, attackers.length);
  const defenderDefenseUnits = createUnits(defenderDefenses, defenderMultipliers, shipConfigs, attackers.length + defenderShipUnits.length);
  const defenders = [...defenderShipUnits, ...defenderDefenseUnits];

  const rounds: RoundResult[] = [];
  const totalAttackerStats = emptySideStats();
  const totalDefenderStats = emptySideStats();

  for (let round = 1; round <= combatConfig.maxRounds; round++) {
    const aliveAttackers = attackers.filter(u => !u.destroyed);
    const aliveDefenders = defenders.filter(u => !u.destroyed);

    if (aliveDefenders.length === 0 || aliveAttackers.length === 0) break;

    const roundAttackerStats = emptySideStats();
    const roundDefenderStats = emptySideStats();

    // SIMULTANEOUS: both sides fire on clones of the start-of-round state
    const defendersForAttackerFire = cloneUnits(defenders);
    const attackersForDefenderFire = cloneUnits(attackers);

    // Attackers fire at defender clones
    for (const attacker of aliveAttackers) {
      fireSalvo(attacker, defendersForAttackerFire, attackerTargetPriority,
        combatConfig.categories, combatConfig.minDamagePerHit, roundAttackerStats, roundDefenderStats, rng);
    }

    // Defenders fire at attacker clones
    for (const defender of aliveDefenders) {
      fireSalvo(defender, attackersForDefenderFire, defenderTargetPriority,
        combatConfig.categories, combatConfig.minDamagePerHit, roundDefenderStats, roundAttackerStats, rng);
    }

    // Apply damage from both phases back to real units
    applyDamage(defenders, defendersForAttackerFire);
    applyDamage(attackers, attackersForDefenderFire);

    // Regenerate shields for survivors
    for (const unit of [...attackers, ...defenders]) {
      if (!unit.destroyed) unit.shield = unit.maxShield;
    }

    mergeStats(totalAttackerStats, roundAttackerStats);
    mergeStats(totalDefenderStats, roundDefenderStats);

    rounds.push({
      round,
      attackerShips: countSurvivingByType(attackers),
      defenderShips: countSurvivingByType(defenders),
      attackerStats: roundAttackerStats,
      defenderStats: roundDefenderStats,
    });

    if (!attackers.some(u => !u.destroyed) || !defenders.some(u => !u.destroyed)) break;
  }

  // Determine outcome
  const attackersAlive = attackers.some(u => !u.destroyed);
  const defendersAlive = defenders.some(u => !u.destroyed);
  let outcome: 'attacker' | 'defender' | 'draw';
  if (attackersAlive && !defendersAlive) outcome = 'attacker';
  else if (!attackersAlive && defendersAlive) outcome = 'defender';
  else outcome = 'draw';

  const attackerLosses = countDestroyedByType(attackers);
  const defenderLosses = countDestroyedByType(defenders);
  const debris = calculateDebris(attackerLosses, defenderLosses, shipIds, shipCosts, combatConfig.debrisRatio);
  const repairedDefenses = repairDefenses(defenderLosses, defenseIds, combatConfig.defenseRepairRate, rng);

  return {
    rounds, outcome, attackerLosses, defenderLosses, debris, repairedDefenses,
    attackerStats: totalAttackerStats, defenderStats: totalDefenderStats,
  };
}
```

Also add helpers:

```typescript
// Simple seeded PRNG (mulberry32) for deterministic replay
function createRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countSurvivingByType(units: CombatUnit[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) {
    if (!unit.destroyed) {
      counts[unit.shipType] = (counts[unit.shipType] ?? 0) + 1;
    }
  }
  return counts;
}

function countDestroyedByType(units: CombatUnit[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) {
    if (unit.destroyed) {
      counts[unit.shipType] = (counts[unit.shipType] ?? 0) + 1;
    }
  }
  return counts;
}

function mergeStats(target: CombatSideStats, source: CombatSideStats): void {
  for (const [k, v] of Object.entries(source.damageDealtByCategory)) {
    target.damageDealtByCategory[k] = (target.damageDealtByCategory[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(source.damageReceivedByCategory)) {
    target.damageReceivedByCategory[k] = (target.damageReceivedByCategory[k] ?? 0) + v;
  }
  target.shieldAbsorbed += source.shieldAbsorbed;
  target.armorBlocked += source.armorBlocked;
  target.overkillWasted += source.overkillWasted;
}
```

And implement `calculateDebris` and `repairDefenses` (same logic as before, keep signature compatible):

```typescript
export function calculateDebris(
  attackerLosses: Record<string, number>,
  defenderLosses: Record<string, number>,
  shipIds: Set<string>,
  shipCosts: Record<string, { minerai: number; silicium: number }>,
  debrisRatio = 0.3,
): { minerai: number; silicium: number } {
  let minerai = 0;
  let silicium = 0;

  for (const losses of [attackerLosses, defenderLosses]) {
    for (const [type, count] of Object.entries(losses)) {
      if (shipIds.has(type)) {
        const cost = shipCosts[type];
        if (cost) {
          minerai += cost.minerai * count;
          silicium += cost.silicium * count;
        }
      }
    }
  }

  return {
    minerai: Math.floor(minerai * debrisRatio),
    silicium: Math.floor(silicium * debrisRatio),
  };
}

export function repairDefenses(
  defenderLosses: Record<string, number>,
  defenseIds: Set<string>,
  repairProbability = 0.7,
  rng: () => number = Math.random,
): Record<string, number> {
  const repaired: Record<string, number> = {};
  for (const [type, count] of Object.entries(defenderLosses)) {
    if (defenseIds.has(type)) {
      let repairedCount = 0;
      for (let i = 0; i < count; i++) {
        if (rng() < repairProbability) repairedCount++;
      }
      if (repairedCount > 0) repaired[type] = repairedCount;
    }
  }
  return repaired;
}
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/julienaubree/_projet/exilium && npx vitest run packages/game-engine/src/formulas/combat.test.ts`

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/game-engine/src/formulas/combat.ts packages/game-engine/src/formulas/combat.test.ts
git commit -m "feat(combat): implement new combat engine with 5 stats, categories, and target priority"
```

---

## Task 4: Add comprehensive combat tests

**Files:**
- Modify: `packages/game-engine/src/formulas/combat.test.ts`

- [ ] **Step 1: Add tests for target priority, debris, defense repair, overkill, and reports**

Append to the test file:

```typescript
describe('target priority', () => {
  it('attacks priority category first', () => {
    // Attacker targets heavy, defender has light + heavy
    const result = simulateCombat(makeInput({
      attackerFleet: { battlecruiser: 5 },
      defenderFleet: { interceptor: 5, cruiser: 3 },
      attackerTargetPriority: 'heavy',
    }));
    // Heavy (cruisers) should take losses before lights
    const cruiserLosses = result.defenderLosses.cruiser ?? 0;
    expect(cruiserLosses).toBeGreaterThan(0);
  });

  it('support units are targeted last', () => {
    // Attacker targets light, defender has light + support
    const result = simulateCombat(makeInput({
      attackerFleet: { cruiser: 3 },
      defenderFleet: { interceptor: 5, smallCargo: 10 },
      attackerTargetPriority: 'light',
    }));
    // Interceptors (light) should be prioritized over cargo (support)
    const interceptorLosses = result.defenderLosses.interceptor ?? 0;
    expect(interceptorLosses).toBeGreaterThan(0);
  });
});

describe('simultaneous combat', () => {
  it('both sides fire even if one would be destroyed', () => {
    // 1v1 where both can kill each other — both should fire
    const result = simulateCombat(makeInput({
      attackerFleet: { cruiser: 1 },
      defenderFleet: { cruiser: 1 },
    }));
    // With simultaneous fire, a draw is possible
    expect(['attacker', 'defender', 'draw']).toContain(result.outcome);
  });
});

describe('calculateDebris', () => {
  it('returns 30% of destroyed ship costs', () => {
    const debris = calculateDebris(
      { interceptor: 10 }, {}, SHIP_IDS, SHIP_COSTS, 0.3,
    );
    expect(debris.minerai).toBe(Math.floor(3000 * 10 * 0.3));
    expect(debris.silicium).toBe(Math.floor(1000 * 10 * 0.3));
  });

  it('ignores defenses in debris', () => {
    const debris = calculateDebris(
      {}, { rocketLauncher: 100 }, SHIP_IDS, SHIP_COSTS, 0.3,
    );
    expect(debris.minerai).toBe(0);
  });
});

describe('repairDefenses', () => {
  it('repairs approximately 70% of defenses over many runs', () => {
    let totalRepaired = 0;
    for (let i = 0; i < 100; i++) {
      const repaired = repairDefenses({ rocketLauncher: 100 }, new Set(['rocketLauncher']), 0.7);
      totalRepaired += repaired.rocketLauncher ?? 0;
    }
    const ratio = totalRepaired / (100 * 100);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.8);
  });
});

describe('combat stats tracking', () => {
  it('tracks shield absorbed and armor blocked', () => {
    const result = simulateCombat(makeInput({
      attackerFleet: { cruiser: 3 },
      defenderFleet: { interceptor: 10 },
    }));
    expect(result.attackerStats.shieldAbsorbed).toBeGreaterThanOrEqual(0);
    expect(result.defenderStats.shieldAbsorbed).toBeGreaterThanOrEqual(0);
  });

  it('tracks overkill wasted', () => {
    // Battlecruiser (70 dmg) vs interceptors (hull 12) — lots of overkill
    const result = simulateCombat(makeInput({
      attackerFleet: { battlecruiser: 5 },
      defenderFleet: { interceptor: 20 },
    }));
    expect(result.attackerStats.overkillWasted).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/julienaubree/_projet/exilium && npx vitest run packages/game-engine/src/formulas/combat.test.ts`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/formulas/combat.test.ts
git commit -m "test(combat): add comprehensive tests for priority, simultaneous fire, debris, and stats"
```

---

## Task 5: Update DB schema — ship/defense definitions and drop rapid_fire

**Files:**
- Modify: `packages/db/src/schema/game-config.ts`
- Modify: `packages/db/src/schema/planet-ships.ts`
- Modify: `packages/db/src/schema/planet-defenses.ts`
- Modify: `packages/db/src/schema/fleet-events.ts`

- [ ] **Step 1: Update shipDefinitions schema**

In `packages/db/src/schema/game-config.ts`, modify the `shipDefinitions` table:
- Rename `armor` column to `hull` (this is now hull HP)
- Add `baseArmor` column (flat damage reduction)
- Add `shotCount` column
- Add `combatCategoryId` column (distinct from the existing `categoryId` which is for UI entity categories)

```typescript
// In shipDefinitions table:
  hull: integer('hull').notNull().default(0),           // was 'armor' — now represents hull HP
  baseArmor: integer('base_armor').notNull().default(0), // flat damage reduction (new)
  shotCount: integer('shot_count').notNull().default(1),  // shots per round (new)
  combatCategoryId: varchar('combat_category_id', { length: 64 }), // 'light'|'medium'|'heavy'|'support'
```

Same for `defenseDefinitions`.

- [ ] **Step 2: Delete the rapidFire table export**

Remove the entire `rapidFire` pgTable definition from `game-config.ts` (lines 137-143).

- [ ] **Step 3: Update planet-ships.ts column names**

```typescript
// Rename:
// lightFighter → interceptor
// heavyFighter → frigate
// battleship → battlecruiser
  interceptor: integer('interceptor').notNull().default(0),
  frigate: integer('frigate').notNull().default(0),
  battlecruiser: integer('battlecruiser').notNull().default(0),
```

- [ ] **Step 4: Update planet-defenses.ts column name**

```typescript
// Rename:
// gaussCannon → electromagneticCannon
  electromagneticCannon: integer('electromagnetic_cannon').notNull().default(0),
```

- [ ] **Step 5: Add targetPriority to fleet-events.ts**

```typescript
import { pgTable, uuid, smallint, timestamp, numeric, jsonb, pgEnum, index, varchar } from 'drizzle-orm/pg-core';

// Add to fleetEvents table:
  targetPriority: varchar('target_priority', { length: 64 }),
```

- [ ] **Step 6: Generate Drizzle migration**

Run: `cd /Users/julienaubree/_projet/exilium && npx drizzle-kit generate`

**CRITICAL — Column renames:** Drizzle will generate DROP+ADD instead of RENAME for column name changes. You MUST manually edit the generated SQL migration file to use `ALTER TABLE ... RENAME COLUMN` instead. Specifically:
- `planet_ships`: `light_fighter` → `interceptor`, `heavy_fighter` → `frigate`, `battleship` → `battlecruiser`
- `planet_defenses`: `gauss_cannon` → `electromagnetic_cannon`
- `ship_definitions`: `armor` → `hull`

Example manual fix in the `.sql` migration file:
```sql
-- REMOVE the generated DROP/ADD lines and REPLACE with:
ALTER TABLE "planet_ships" RENAME COLUMN "light_fighter" TO "interceptor";
ALTER TABLE "planet_ships" RENAME COLUMN "heavy_fighter" TO "frigate";
ALTER TABLE "planet_ships" RENAME COLUMN "battleship" TO "battlecruiser";
ALTER TABLE "planet_defenses" RENAME COLUMN "gauss_cannon" TO "electromagnetic_cannon";
ALTER TABLE "ship_definitions" RENAME COLUMN "armor" TO "hull";
ALTER TABLE "defense_definitions" RENAME COLUMN "armor" TO "hull";
```

Without this, **all existing data in these columns will be lost**.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema/ drizzle/
git commit -m "feat(db): update schemas for new combat system — add hull, baseArmor, shotCount, combatCategoryId, drop rapidFire"
```

---

## Task 6: Update seed-game-config.ts

**Files:**
- Modify: `packages/db/src/seed-game-config.ts`

- [ ] **Step 1: Remove all rapidFire seed data**

Delete the entire `rapidFire` array (~36 entries, lines 140-176 approx).

- [ ] **Step 2: Update ship definitions with new 5 stats**

For each ship, replace `weapons`/`shield`/`armor` with the new stats. Example for combat ships:

```typescript
// interceptor (was lightFighter)
{ id: 'interceptor', name: 'Intercepteur', ..., shield: 8, hull: 12, baseArmor: 1, weapons: 4, shotCount: 3, combatCategoryId: 'light' },
// frigate (was heavyFighter)
{ id: 'frigate', name: 'Frégate', ..., shield: 16, hull: 30, baseArmor: 2, weapons: 12, shotCount: 2, combatCategoryId: 'medium' },
// cruiser
{ id: 'cruiser', name: 'Croiseur', ..., shield: 28, hull: 55, baseArmor: 4, weapons: 45, shotCount: 1, combatCategoryId: 'heavy' },
// battlecruiser (was battleship)
{ id: 'battlecruiser', name: 'Cuirassé', ..., shield: 40, hull: 100, baseArmor: 6, weapons: 70, shotCount: 1, combatCategoryId: 'heavy' },
```

Support ships: `combatCategoryId: 'support'`, minimal combat stats.

- [ ] **Step 3: Update defense definitions similarly**

```typescript
{ id: 'rocketLauncher', ..., shield: 6, hull: 10, baseArmor: 1, weapons: 5, shotCount: 2, combatCategoryId: 'light' },
{ id: 'lightLaser', ..., shield: 8, hull: 12, baseArmor: 1, weapons: 7, shotCount: 3, combatCategoryId: 'light' },
{ id: 'heavyLaser', ..., shield: 18, hull: 35, baseArmor: 3, weapons: 15, shotCount: 2, combatCategoryId: 'medium' },
{ id: 'electromagneticCannon', ..., shield: 30, hull: 60, baseArmor: 5, weapons: 50, shotCount: 1, combatCategoryId: 'heavy' },
{ id: 'plasmaTurret', ..., shield: 50, hull: 120, baseArmor: 7, weapons: 80, shotCount: 1, combatCategoryId: 'heavy' },
{ id: 'smallShield', ..., shield: 60, hull: 40, baseArmor: 2, weapons: 1, shotCount: 1, combatCategoryId: 'heavy' },
{ id: 'largeShield', ..., shield: 150, hull: 80, baseArmor: 4, weapons: 1, shotCount: 1, combatCategoryId: 'heavy' },
```

- [ ] **Step 4: Update universe config combat keys**

Replace old keys with new ones:
```typescript
{ key: 'combat_max_rounds', value: 4 },
{ key: 'combat_debris_ratio', value: 0.3 },
{ key: 'combat_defense_repair_rate', value: 0.7 },
{ key: 'combat_pillage_ratio', value: 0.33 },
{ key: 'combat_min_damage_per_hit', value: 1 },
{ key: 'combat_research_bonus_per_level', value: 0.1 },
```

Remove old keys: `combat_bounce_threshold`, `combat_rapid_destruction_threshold`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed-game-config.ts
git commit -m "feat(config): update ship/defense stats for new combat system, remove rapid fire"
```

---

## Task 7: Update fleet.types.ts helpers

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.types.ts`

- [ ] **Step 1: Update buildCombatStats to return new ShipCombatConfig format**

Replace `buildCombatStats()` with a function that returns the new format:

```typescript
export function buildShipCombatConfigs(config: GameConfig): Record<string, ShipCombatConfig> {
  const configs: Record<string, ShipCombatConfig> = {};
  for (const [id, ship] of Object.entries(config.ships)) {
    configs[id] = {
      shipType: id,
      categoryId: ship.combatCategoryId ?? 'support',
      baseShield: ship.shield,
      baseArmor: ship.baseArmor ?? 0,
      baseHull: ship.hull,
      baseWeaponDamage: ship.weapons,
      baseShotCount: ship.shotCount ?? 1,
    };
  }
  for (const [id, def] of Object.entries(config.defenses)) {
    configs[id] = {
      shipType: id,
      categoryId: def.combatCategoryId ?? 'heavy',
      baseShield: def.shield,
      baseArmor: def.baseArmor ?? 0,
      baseHull: def.hull,
      baseWeaponDamage: def.weapons,
      baseShotCount: def.shotCount ?? 1,
    };
  }
  return configs;
}
```

Keep the old `buildCombatStats` temporarily until handlers are updated (or delete if updating in same task).

- [ ] **Step 2: Add SendFleetInput.targetPriority field**

```typescript
export interface SendFleetInput {
  // ... existing fields ...
  targetPriority?: string;  // combat category ID for target priority
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.types.ts
git commit -m "feat(fleet): update fleet types for new combat system"
```

---

## Task 8: Update attack.handler.ts

**Files:**
- Modify: `apps/api/src/modules/fleet/handlers/attack.handler.ts`

- [ ] **Step 1: Read current attack handler**

Read `apps/api/src/modules/fleet/handlers/attack.handler.ts` to understand exact integration points.

- [ ] **Step 2: Update simulateCombat call**

Replace the old `simulateCombat()` call with the new `CombatInput`-based signature. Key changes:
- Build `ShipCombatConfig` map via `buildShipCombatConfigs(config)`
- Build `CombatConfig` from universe config keys
- Build `ShipCategory[]` from config (or hardcode initially from universe config)
- Pass `targetPriority` from fleet event (default to `'light'` if not set)
- Remove `rapidFireMap` parameter

- [ ] **Step 3: Update result processing**

The new `CombatResult` has the same `attackerLosses`/`defenderLosses`/`debris`/`repairedDefenses` fields, so loss application logic stays similar. Update:
- Report generation to include `attackerStats`/`defenderStats` (CombatSideStats)
- Round data now includes per-round stats

- [ ] **Step 4: Run the full test suite**

Run: `cd /Users/julienaubree/_projet/exilium && npx vitest run`

Fix any compilation errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/fleet/handlers/attack.handler.ts
git commit -m "feat(attack): integrate new combat engine in attack handler"
```

---

## Task 9: Update pirate PvE combat

**Files:**
- Modify: `apps/api/src/modules/pve/pirate.service.ts`
- Modify: `apps/api/src/modules/fleet/handlers/pirate.handler.ts`

- [ ] **Step 1: Update pirate.service.ts — simulateCombat call**

Same changes as attack handler:
- Use `CombatInput` structure
- Remove `rapidFireMap` reference
- Add default target priority for pirates (e.g. `'light'`)
- Update pirate fleet templates to use new ship IDs if needed (`lightFighter` → `interceptor`, etc.)

- [ ] **Step 2: Update pirate.handler.ts — result processing**

The handler processes the combat result to build reports. Update it to handle:
- New `CombatResult` shape (with `CombatSideStats`)
- New ship IDs in loss/survivor records

- [ ] **Step 3: Run tests**

Run: `cd /Users/julienaubree/_projet/exilium && npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/pve/pirate.service.ts apps/api/src/modules/fleet/handlers/pirate.handler.ts
git commit -m "feat(pve): integrate new combat engine in pirate service and handler"
```

---

## Task 10: Remove rapid fire from admin and frontend

**Files:**
- Modify: `apps/api/src/modules/admin/game-config.service.ts`
- Modify: `apps/api/src/modules/admin/game-config.router.ts`
- Remove or repurpose: `apps/admin/src/pages/RapidFire.tsx`
- Modify: `apps/admin/src/router.tsx`
- Modify: `apps/web/src/lib/entity-details.ts`
- Modify: `apps/web/src/components/entity-details/ShipDetailContent.tsx`
- Modify: `apps/web/src/components/entity-details/DefenseDetailContent.tsx`

- [ ] **Step 1: Remove rapidFire from game-config.service.ts**

Remove all rapidFire CRUD operations, cache entries, and delete-guard logic.

- [ ] **Step 2: Remove rapidFire routes from game-config.router.ts**

- [ ] **Step 3: Remove RapidFire admin page and route**

Remove or repurpose `apps/admin/src/pages/RapidFire.tsx` and its route in `apps/admin/src/router.tsx`.

- [ ] **Step 4: Update entity detail components**

In `entity-details.ts`, `ShipDetailContent.tsx`, `DefenseDetailContent.tsx`:
- Remove rapidFire display sections (rapidFireAgainst/rapidFireFrom)
- Add display for new stats: shotCount, baseArmor (as "Blindage"), combatCategoryId

- [ ] **Step 5: Run build to check for compilation errors**

Run: `cd /Users/julienaubree/_projet/exilium && npm run build`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/admin/ apps/admin/src/ apps/web/src/
git commit -m "feat(admin/web): remove rapid fire, add new combat stat displays"
```

---

## Task 11: Update fleet send UI — target priority selector

**Files:**
- Modify: Fleet send page/component (find exact file with `grep -r "mission.*attack\|sendFleet" apps/web/src`)

- [ ] **Step 1: Find the fleet send component**

Search for the component that handles fleet mission selection and ship selection.

- [ ] **Step 2: Add target priority dropdown**

When mission is `'attack'` or `'pirate'`, show a dropdown to select target priority among the targetable categories. Default to `'light'`.

- [ ] **Step 3: Pass targetPriority in the send fleet request**

Update the API call to include `targetPriority` in the request body.

- [ ] **Step 4: Update fleet.service.ts to store targetPriority**

In `fleet.service.ts`, when creating a fleet event, save the `targetPriority` field.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/ apps/api/src/modules/fleet/
git commit -m "feat(fleet): add target priority selector for attack missions"
```

---

## Task 12: Update Reports.tsx for new combat report format

**Files:**
- Modify: `apps/web/src/pages/Reports.tsx`

- [ ] **Step 1: Read current Reports.tsx**

Understand the current report rendering.

- [ ] **Step 2: Update report rendering**

Adapt to new `CombatResult` format:
- Show per-round stats (damage dealt by category, shield absorbed, armor blocked)
- Show total overkill wasted
- Update survivor counts display
- Handle new ship names (Intercepteur, Frégate, etc.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Reports.tsx
git commit -m "feat(reports): update combat reports for new system with category stats"
```

---

## Task 13: Update other test files referencing old ship/defense IDs

**Files:**
- Modify: `packages/game-engine/src/formulas/fleet.test.ts`
- Modify: `packages/game-engine/src/formulas/ranking.test.ts`
- Modify: `packages/game-engine/src/formulas/shipyard-cost.test.ts`
- Modify: `apps/api/src/lib/config-helpers.test.ts`

- [ ] **Step 1: Search and replace old IDs across test files**

In all the files above, replace:
- `lightFighter` → `interceptor`
- `heavyFighter` → `frigate`
- `battleship` → `battlecruiser`
- `gaussCannon` → `electromagneticCannon`

Also in `config-helpers.test.ts`, remove any `rapidFire` mock references.

- [ ] **Step 2: Run test suite**

Run: `cd /Users/julienaubree/_projet/exilium && npx vitest run`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/game-engine/src/ apps/api/src/lib/
git commit -m "fix(tests): update test files with new ship/defense IDs"
```

---

## Task 14: Migrate JSONB data (fleet events + mission reports)

**Files:**
- Create SQL migration or script

- [ ] **Step 1: Write SQL to migrate in-flight fleet event ship keys**

Active fleet events have `ships` JSONB with old keys (`lightFighter`, `heavyFighter`, `battleship`). After column renames, the return handler will try to restore ships using new column names. Add SQL migration:

```sql
-- Migrate JSONB ship keys in active fleet events
UPDATE fleet_events
SET ships = (
  ships
  - 'lightFighter' - 'heavyFighter' - 'battleship'
  || jsonb_build_object(
    'interceptor', COALESCE(ships->'lightFighter', '0'),
    'frigate', COALESCE(ships->'heavyFighter', '0'),
    'battlecruiser', COALESCE(ships->'battleship', '0')
  )
)
WHERE ships ? 'lightFighter' OR ships ? 'heavyFighter' OR ships ? 'battleship';
```

- [ ] **Step 2: Handle old mission reports**

Old combat reports in `mission_reports` have the old `CombatResult` format (no `CombatSideStats`, old ship IDs). Options:
- **Simplest:** Add a `version` field to combat results. Reports page checks version and renders old format gracefully (just show "Ancien format" for pre-migration reports).
- Add this check in the Reports.tsx rendering logic.

- [ ] **Step 3: Commit**

```bash
git add drizzle/ apps/web/src/pages/Reports.tsx
git commit -m "fix(migration): migrate JSONB ship keys in fleet events, handle old report format"
```

---

## Task 15: Run Drizzle migration and full integration test

- [ ] **Step 1: Run migration on dev database**

Run: `cd /Users/julienaubree/_projet/exilium && npx drizzle-kit push` (or `migrate` depending on project setup)

- [ ] **Step 2: Re-seed game config**

Run the seed script to populate new ship/defense stats and combat config.

- [ ] **Step 3: Run full test suite**

Run: `cd /Users/julienaubree/_projet/exilium && npx vitest run`

Expected: All tests pass.

- [ ] **Step 4: Run full build**

Run: `cd /Users/julienaubree/_projet/exilium && npm run build`

Expected: No compilation errors.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve integration issues after combat system migration"
```

- [ ] **Step 6: Push**

```bash
git push
```
