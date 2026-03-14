# Phase 5b : Combat, Espionnage, Débris & Recyclage — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le combat OGame classique (rounds, rapid fire, débris, 70% defense repair), l'espionnage par sondes, les champs de débris et la mission recycleur.

**Architecture:** Formules de combat et espionnage dans le game-engine (fonctions pures, testables). Nouveau schema debris_fields + migration enums. Handlers processAttack/processSpy/processRecycle dans fleet.service. Frontend : activation des missions spy/attack/recycle + indicateur débris galaxie.

**Tech Stack:** game-engine (formules combat/espionage), Drizzle ORM (debris_fields, enum migrations), tRPC (fleet handlers), React (Galaxy/Fleet/Messages updates)

---

## File Structure

### game-engine (constants + formulas)

| File | Responsabilité |
|------|---------------|
| `packages/game-engine/src/constants/combat-stats.ts` | COMBAT_STATS (armes/bouclier/blindage) + RAPID_FIRE |
| `packages/game-engine/src/formulas/combat.ts` | simulateCombat, calculateDebris |
| `packages/game-engine/src/formulas/combat.test.ts` | Tests combat (~10 tests) |
| `packages/game-engine/src/formulas/espionage.ts` | calculateSpyReport, calculateDetectionChance |
| `packages/game-engine/src/formulas/espionage.test.ts` | Tests espionnage (~5 tests) |

### db (schema)

| File | Responsabilité |
|------|---------------|
| `packages/db/src/schema/debris-fields.ts` | Table debris_fields |

### api (fleet handlers)

| File | Responsabilité |
|------|---------------|
| `apps/api/src/modules/fleet/fleet.service.ts` | processAttack, processSpy, processRecycle + routing |

### web (frontend updates)

| File | Responsabilité |
|------|---------------|
| `apps/web/src/pages/Galaxy.tsx` | Indicateur débris sur les positions |
| `apps/web/src/pages/Fleet.tsx` | Activer missions spy/attack/recycle |
| `apps/web/src/pages/Messages.tsx` | Ajouter filtres combat/espionage |

---

## Chunk 1: Combat Stats + Espionage Formulas

### Task 1: Combat stats constants

**Files:**
- Create: `packages/game-engine/src/constants/combat-stats.ts`

- [ ] **Step 1: Créer le fichier combat-stats.ts**

```typescript
// packages/game-engine/src/constants/combat-stats.ts

export interface UnitCombatStats {
  weapons: number;
  shield: number;
  armor: number;
}

export const COMBAT_STATS: Record<string, UnitCombatStats> = {
  // Ships
  smallCargo:     { weapons: 5,    shield: 10,    armor: 4000 },
  largeCargo:     { weapons: 5,    shield: 25,    armor: 12000 },
  lightFighter:   { weapons: 50,   shield: 10,    armor: 4000 },
  heavyFighter:   { weapons: 150,  shield: 25,    armor: 10000 },
  cruiser:        { weapons: 400,  shield: 50,    armor: 27000 },
  battleship:     { weapons: 1000, shield: 200,   armor: 60000 },
  espionageProbe: { weapons: 0,    shield: 0,     armor: 1000 },
  colonyShip:     { weapons: 50,   shield: 100,   armor: 30000 },
  recycler:       { weapons: 1,    shield: 10,    armor: 16000 },
  // Defenses
  rocketLauncher: { weapons: 80,   shield: 20,    armor: 2000 },
  lightLaser:     { weapons: 100,  shield: 25,    armor: 2000 },
  heavyLaser:     { weapons: 250,  shield: 100,   armor: 8000 },
  gaussCannon:    { weapons: 1100, shield: 200,   armor: 35000 },
  plasmaTurret:   { weapons: 3000, shield: 300,   armor: 100000 },
  smallShield:    { weapons: 1,    shield: 2000,  armor: 2000 },
  largeShield:    { weapons: 1,    shield: 10000, armor: 10000 },
};

// rapidFire[attacker][target] = N → (N-1)/N chance to fire again
export const RAPID_FIRE: Record<string, Record<string, number>> = {
  smallCargo:   { espionageProbe: 5 },
  largeCargo:   { espionageProbe: 5 },
  lightFighter: { espionageProbe: 5 },
  heavyFighter: { espionageProbe: 5, smallCargo: 3 },
  cruiser:      { espionageProbe: 5, lightFighter: 6, smallCargo: 3, rocketLauncher: 10 },
  battleship:   { espionageProbe: 5, lightFighter: 4, smallCargo: 4, largeCargo: 4 },
  colonyShip:   { espionageProbe: 5 },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/game-engine/src/constants/combat-stats.ts
git commit -m "feat(game-engine): add combat stats constants and rapid fire table"
```

---

### Task 2: Espionage formulas + tests

**Files:**
- Create: `packages/game-engine/src/formulas/espionage.ts`
- Create: `packages/game-engine/src/formulas/espionage.test.ts`

- [ ] **Step 1: Créer espionage.ts**

```typescript
// packages/game-engine/src/formulas/espionage.ts

export interface SpyReportVisibility {
  resources: boolean;
  fleet: boolean;
  defenses: boolean;
  buildings: boolean;
  research: boolean;
}

export function calculateSpyReport(
  probeCount: number,
  attackerEspionageTech: number,
  defenderEspionageTech: number,
): SpyReportVisibility {
  const probInfo = probeCount - (defenderEspionageTech - attackerEspionageTech);

  return {
    resources: probInfo >= 1,
    fleet: probInfo >= 3,
    defenses: probInfo >= 5,
    buildings: probInfo >= 7,
    research: probInfo >= 9,
  };
}

export function calculateDetectionChance(
  probeCount: number,
  attackerEspionageTech: number,
  defenderEspionageTech: number,
): number {
  const chance = probeCount * 2 - (attackerEspionageTech - defenderEspionageTech) * 4;
  return Math.max(0, Math.min(100, chance));
}
```

- [ ] **Step 2: Créer espionage.test.ts**

```typescript
// packages/game-engine/src/formulas/espionage.test.ts
import { describe, it, expect } from 'vitest';
import { calculateSpyReport, calculateDetectionChance } from './espionage.js';

describe('calculateSpyReport', () => {
  it('3 probes same tech → resources + fleet visible, not defenses', () => {
    const report = calculateSpyReport(3, 5, 5);
    expect(report.resources).toBe(true);
    expect(report.fleet).toBe(true);
    expect(report.defenses).toBe(false);
    expect(report.buildings).toBe(false);
    expect(report.research).toBe(false);
  });

  it('1 probe, defender +5 tech → nothing visible', () => {
    const report = calculateSpyReport(1, 0, 5);
    expect(report.resources).toBe(false);
    expect(report.fleet).toBe(false);
  });

  it('10 probes, attacker +3 tech → everything visible', () => {
    const report = calculateSpyReport(10, 8, 5);
    expect(report.resources).toBe(true);
    expect(report.fleet).toBe(true);
    expect(report.defenses).toBe(true);
    expect(report.buildings).toBe(true);
    expect(report.research).toBe(true);
  });

  it('5 probes same tech → resources + fleet + defenses', () => {
    const report = calculateSpyReport(5, 3, 3);
    expect(report.resources).toBe(true);
    expect(report.fleet).toBe(true);
    expect(report.defenses).toBe(true);
    expect(report.buildings).toBe(false);
  });
});

describe('calculateDetectionChance', () => {
  it('1 probe same tech → 2%', () => {
    expect(calculateDetectionChance(1, 5, 5)).toBe(2);
  });

  it('10 probes same tech → 20%', () => {
    expect(calculateDetectionChance(10, 5, 5)).toBe(20);
  });

  it('high attacker tech reduces detection', () => {
    // 1 probe, attacker +10 tech → 2 - 40 = -38 → clamped to 0
    expect(calculateDetectionChance(1, 15, 5)).toBe(0);
  });

  it('never exceeds 100', () => {
    expect(calculateDetectionChance(100, 0, 0)).toBe(100);
  });

  it('high defender tech increases detection', () => {
    // 5 probes, defender +3 tech → 10 - (-12) = 22
    expect(calculateDetectionChance(5, 2, 5)).toBe(22);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo test --filter=@ogame-clone/game-engine
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add packages/game-engine/src/formulas/espionage.ts packages/game-engine/src/formulas/espionage.test.ts
git commit -m "feat(game-engine): add espionage formulas with tests"
```

---

### Task 3: Combat simulation + tests

**Files:**
- Create: `packages/game-engine/src/formulas/combat.ts`
- Create: `packages/game-engine/src/formulas/combat.test.ts`

- [ ] **Step 1: Créer combat.ts**

```typescript
// packages/game-engine/src/formulas/combat.ts
import { COMBAT_STATS, type UnitCombatStats } from '../constants/combat-stats.js';
import { RAPID_FIRE } from '../constants/combat-stats.js';
import { SHIPS } from '../constants/ships.js';

export interface CombatTechs {
  weapons: number;
  shielding: number;
  armor: number;
}

export interface CombatResult {
  rounds: number;
  outcome: 'attacker_wins' | 'defender_wins' | 'draw';
  attackerLosses: Record<string, number>;
  defenderShipLosses: Record<string, number>;
  defenderDefenseLosses: Record<string, number>;
  debris: { metal: number; crystal: number };
  defenderDefensesRepaired: Record<string, number>;
}

interface CombatUnit {
  type: string;
  side: 'attacker' | 'defender';
  isDefense: boolean;
  weapons: number;
  shieldBase: number;
  shieldCurrent: number;
  armorBase: number;
  armorCurrent: number;
  alive: boolean;
}

const DEFENSE_IDS = new Set([
  'rocketLauncher', 'lightLaser', 'heavyLaser',
  'gaussCannon', 'plasmaTurret', 'smallShield', 'largeShield',
]);

function createUnits(
  counts: Record<string, number>,
  techs: CombatTechs,
  side: 'attacker' | 'defender',
  isDefense: boolean,
): CombatUnit[] {
  const units: CombatUnit[] = [];
  for (const [type, count] of Object.entries(counts)) {
    const stats = COMBAT_STATS[type];
    if (!stats || count <= 0) continue;
    for (let i = 0; i < count; i++) {
      const weapons = stats.weapons * (1 + 0.1 * techs.weapons);
      const shield = stats.shield * (1 + 0.1 * techs.shielding);
      const armor = stats.armor * (1 + 0.1 * techs.armor);
      units.push({
        type,
        side,
        isDefense,
        weapons,
        shieldBase: shield,
        shieldCurrent: shield,
        armorBase: armor,
        armorCurrent: armor,
        alive: true,
      });
    }
  }
  return units;
}

function fireAtTarget(attacker: CombatUnit, target: CombatUnit): void {
  const damage = attacker.weapons;

  // Bounce rule: if damage < 1% of shield base, no effect
  if (damage < 0.01 * target.shieldBase) return;

  // Shield absorbs first
  const shieldAbsorb = Math.min(target.shieldCurrent, damage);
  target.shieldCurrent -= shieldAbsorb;
  const remainingDamage = damage - shieldAbsorb;

  // Remaining goes to armor
  if (remainingDamage > 0) {
    target.armorCurrent -= remainingDamage;
  }

  // Rapid destruction: if armor <= 30% of initial, chance to explode
  if (target.armorCurrent > 0 && target.armorCurrent <= 0.3 * target.armorBase) {
    const explodeChance = 1 - target.armorCurrent / target.armorBase;
    if (Math.random() < explodeChance) {
      target.armorCurrent = 0;
    }
  }

  if (target.armorCurrent <= 0) {
    target.alive = false;
  }
}

function executeRound(attackers: CombatUnit[], defenders: CombatUnit[]): void {
  const allUnits = [...attackers, ...defenders].filter(u => u.alive);

  for (const unit of allUnits) {
    if (!unit.alive) continue;

    const enemies = (unit.side === 'attacker' ? defenders : attackers).filter(u => u.alive);
    if (enemies.length === 0) continue;

    // Pick random target and fire
    let target = enemies[Math.floor(Math.random() * enemies.length)];
    fireAtTarget(unit, target);

    // Rapid fire: chance to fire again
    const rf = RAPID_FIRE[unit.type];
    if (rf) {
      let keepFiring = true;
      while (keepFiring) {
        const livingEnemies = (unit.side === 'attacker' ? defenders : attackers).filter(u => u.alive);
        if (livingEnemies.length === 0) break;

        target = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
        const rfValue = rf[target.type];
        if (rfValue && Math.random() < (rfValue - 1) / rfValue) {
          fireAtTarget(unit, target);
        } else {
          keepFiring = false;
        }
      }
    }
  }

  // Regenerate shields, remove dead
  for (const unit of allUnits) {
    if (unit.alive) {
      unit.shieldCurrent = unit.shieldBase;
    }
  }
}

function countLosses(
  originalCounts: Record<string, number>,
  survivingUnits: CombatUnit[],
): Record<string, number> {
  const surviving: Record<string, number> = {};
  for (const unit of survivingUnits) {
    surviving[unit.type] = (surviving[unit.type] ?? 0) + 1;
  }
  const losses: Record<string, number> = {};
  for (const [type, count] of Object.entries(originalCounts)) {
    const lost = count - (surviving[type] ?? 0);
    if (lost > 0) losses[type] = lost;
  }
  return losses;
}

export function calculateDebris(
  destroyedShips: Record<string, number>,
): { metal: number; crystal: number } {
  let metal = 0;
  let crystal = 0;

  for (const [type, count] of Object.entries(destroyedShips)) {
    const shipDef = SHIPS[type as keyof typeof SHIPS];
    if (!shipDef || count <= 0) continue;
    metal += count * shipDef.cost.metal * 0.3;
    crystal += count * shipDef.cost.crystal * 0.3;
  }

  return { metal: Math.floor(metal), crystal: Math.floor(crystal) };
}

function repairDefenses(
  defenseLosses: Record<string, number>,
): Record<string, number> {
  const repaired: Record<string, number> = {};
  for (const [type, count] of Object.entries(defenseLosses)) {
    let repairedCount = 0;
    for (let i = 0; i < count; i++) {
      if (Math.random() < 0.7) repairedCount++;
    }
    if (repairedCount > 0) repaired[type] = repairedCount;
  }
  return repaired;
}

export function simulateCombat(
  attackerFleet: Record<string, number>,
  defenderFleet: Record<string, number>,
  defenderDefenses: Record<string, number>,
  attackerTechs: CombatTechs,
  defenderTechs: CombatTechs,
): CombatResult {
  // Create unit arrays
  const attackers = createUnits(attackerFleet, attackerTechs, 'attacker', false);
  const defenderShips = createUnits(defenderFleet, defenderTechs, 'defender', false);
  const defenderDefs = createUnits(defenderDefenses, defenderTechs, 'defender', true);
  const defenders = [...defenderShips, ...defenderDefs];

  // Simulate rounds
  let rounds = 0;
  for (let r = 0; r < 6; r++) {
    rounds = r + 1;
    executeRound(attackers, defenders);

    const attackersAlive = attackers.some(u => u.alive);
    const defendersAlive = defenders.some(u => u.alive);

    if (!attackersAlive || !defendersAlive) break;
  }

  // Determine outcome
  const attackersAlive = attackers.some(u => u.alive);
  const defendersAlive = defenders.some(u => u.alive);

  let outcome: CombatResult['outcome'];
  if (attackersAlive && !defendersAlive) outcome = 'attacker_wins';
  else if (!attackersAlive && defendersAlive) outcome = 'defender_wins';
  else if (!attackersAlive && !defendersAlive) outcome = 'draw';
  else outcome = 'draw'; // both alive after 6 rounds

  // Count losses
  const attackerLosses = countLosses(attackerFleet, attackers.filter(u => u.alive));
  const defenderShipLosses = countLosses(
    defenderFleet,
    defenderShips.filter(u => u.alive),
  );
  const defenderDefenseLosses = countLosses(
    defenderDefenses,
    defenderDefs.filter(u => u.alive),
  );

  // Debris: 30% of metal+crystal from destroyed SHIPS only (both sides)
  const allDestroyedShips: Record<string, number> = { ...attackerLosses };
  for (const [type, count] of Object.entries(defenderShipLosses)) {
    allDestroyedShips[type] = (allDestroyedShips[type] ?? 0) + count;
  }
  const debris = calculateDebris(allDestroyedShips);

  // Defense repair: 70% chance per destroyed defense
  const defenderDefensesRepaired = repairDefenses(defenderDefenseLosses);

  return {
    rounds,
    outcome,
    attackerLosses,
    defenderShipLosses,
    defenderDefenseLosses,
    debris,
    defenderDefensesRepaired,
  };
}
```

- [ ] **Step 2: Créer combat.test.ts**

```typescript
// packages/game-engine/src/formulas/combat.test.ts
import { describe, it, expect } from 'vitest';
import { simulateCombat, calculateDebris, type CombatTechs } from './combat.js';

const noTechs: CombatTechs = { weapons: 0, shielding: 0, armor: 0 };

describe('calculateDebris', () => {
  it('calculates 30% metal and crystal from destroyed ships', () => {
    // lightFighter costs 3000 metal, 1000 crystal
    const debris = calculateDebris({ lightFighter: 10 });
    expect(debris.metal).toBe(9000);   // 10 * 3000 * 0.3
    expect(debris.crystal).toBe(3000); // 10 * 1000 * 0.3
  });

  it('ignores defense units', () => {
    const debris = calculateDebris({ rocketLauncher: 10 });
    expect(debris.metal).toBe(0);
    expect(debris.crystal).toBe(0);
  });

  it('floors the result', () => {
    // 1 lightFighter: 3000*0.3=900, 1000*0.3=300
    const debris = calculateDebris({ lightFighter: 1 });
    expect(debris.metal).toBe(900);
    expect(debris.crystal).toBe(300);
  });
});

describe('simulateCombat', () => {
  it('asymmetric: 100 battleships vs 10 lightFighters → attacker wins', () => {
    const result = simulateCombat(
      { battleship: 100 },
      { lightFighter: 10 },
      {},
      noTechs,
      noTechs,
    );
    expect(result.outcome).toBe('attacker_wins');
    expect(result.defenderShipLosses.lightFighter).toBe(10);
  });

  it('empty defender → attacker wins immediately', () => {
    const result = simulateCombat(
      { lightFighter: 5 },
      {},
      {},
      noTechs,
      noTechs,
    );
    expect(result.outcome).toBe('attacker_wins');
    expect(result.rounds).toBe(1);
  });

  it('max 6 rounds', () => {
    // Two very tough ships that cannot kill each other easily
    const result = simulateCombat(
      { recycler: 1 },
      { recycler: 1 },
      {},
      noTechs,
      noTechs,
    );
    expect(result.rounds).toBeLessThanOrEqual(6);
  });

  it('bounce: espionageProbe (0 weapons) cannot damage anything', () => {
    const result = simulateCombat(
      { espionageProbe: 10 },
      { battleship: 1 },
      {},
      noTechs,
      noTechs,
    );
    // Probes have 0 weapons → always bounce → battleship takes no damage
    expect(result.outcome).toBe('defender_wins');
  });

  it('techs apply +10% per level', () => {
    // With high weapon tech, attacker should win more easily
    const highTechs: CombatTechs = { weapons: 10, shielding: 0, armor: 0 };
    const result = simulateCombat(
      { lightFighter: 5 },
      { lightFighter: 10 },
      {},
      highTechs, // attacker has +100% weapons
      noTechs,
    );
    // Attacker has 2x damage, should win despite fewer ships
    expect(result.outcome).toBe('attacker_wins');
  });

  it('generates debris from destroyed ships', () => {
    const result = simulateCombat(
      { battleship: 50 },
      { lightFighter: 100 },
      {},
      noTechs,
      noTechs,
    );
    // All lightFighters should be destroyed → debris
    expect(result.debris.metal).toBeGreaterThan(0);
    expect(result.debris.crystal).toBeGreaterThan(0);
  });

  it('defenses generate no debris', () => {
    const result = simulateCombat(
      { battleship: 50 },
      {},
      { rocketLauncher: 100 },
      noTechs,
      noTechs,
    );
    // Defenses destroyed but no ships destroyed on defender side → only attacker ship debris if any
    // All rocketLaunchers destroyed should NOT generate debris
    expect(result.defenderDefenseLosses.rocketLauncher).toBe(100);
  });

  it('defense repair: approximately 70% of destroyed defenses are repaired', () => {
    // Run many combats to get statistical average
    let totalDestroyed = 0;
    let totalRepaired = 0;
    for (let i = 0; i < 100; i++) {
      const result = simulateCombat(
        { battleship: 50 },
        {},
        { rocketLauncher: 20 },
        noTechs,
        noTechs,
      );
      const destroyed = result.defenderDefenseLosses.rocketLauncher ?? 0;
      const repaired = result.defenderDefensesRepaired.rocketLauncher ?? 0;
      totalDestroyed += destroyed;
      totalRepaired += repaired;
    }
    const repairRate = totalRepaired / totalDestroyed;
    expect(repairRate).toBeGreaterThan(0.55); // Allow statistical variance
    expect(repairRate).toBeLessThan(0.85);
  });

  it('rapid fire: cruiser has RF vs lightFighters', () => {
    // 10 cruisers vs 100 lightFighters — cruisers should destroy many thanks to RF 6
    const result = simulateCombat(
      { cruiser: 10 },
      { lightFighter: 100 },
      {},
      noTechs,
      noTechs,
    );
    // With RF 6 vs lightFighters, cruisers fire multiple times per round
    expect(result.defenderShipLosses.lightFighter).toBeGreaterThan(30);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo test --filter=@ogame-clone/game-engine
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add packages/game-engine/src/formulas/combat.ts packages/game-engine/src/formulas/combat.test.ts
git commit -m "feat(game-engine): add combat simulation with tests"
```

---

### Task 4: Export game-engine modules

**Files:**
- Modify: `packages/game-engine/src/index.ts`

- [ ] **Step 1: Ajouter les exports**

Ajouter à la fin du fichier `packages/game-engine/src/index.ts` :

```typescript
export * from './constants/combat-stats.js';
export * from './formulas/combat.js';
export * from './formulas/espionage.js';
```

- [ ] **Step 2: Commit**

```bash
git add packages/game-engine/src/index.ts
git commit -m "feat(game-engine): export combat-stats, combat, and espionage modules"
```

---

## Chunk 2: DB Schema Changes

### Task 5: Table debris_fields + enum updates

**Files:**
- Create: `packages/db/src/schema/debris-fields.ts`
- Modify: `packages/db/src/schema/fleet-events.ts`
- Modify: `packages/db/src/schema/messages.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Créer debris-fields.ts**

```typescript
// packages/db/src/schema/debris-fields.ts
import { pgTable, uuid, smallint, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const debrisFields = pgTable('debris_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  galaxy: smallint('galaxy').notNull(),
  system: smallint('system').notNull(),
  position: smallint('position').notNull(),
  metal: numeric('metal', { precision: 20, scale: 2 }).notNull().default('0'),
  crystal: numeric('crystal', { precision: 20, scale: 2 }).notNull().default('0'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('debris_fields_coords_idx').on(table.galaxy, table.system, table.position),
]);
```

- [ ] **Step 2: Modifier fleet-events.ts — ajouter 'recycle'**

Dans `packages/db/src/schema/fleet-events.ts`, remplacer :

```typescript
export const fleetMissionEnum = pgEnum('fleet_mission', [
  'transport',
  'station',
  'spy',
  'attack',
  'colonize',
]);
```

Par :

```typescript
export const fleetMissionEnum = pgEnum('fleet_mission', [
  'transport',
  'station',
  'spy',
  'attack',
  'colonize',
  'recycle',
]);
```

- [ ] **Step 3: Modifier messages.ts — ajouter 'espionage', 'combat'**

Dans `packages/db/src/schema/messages.ts`, remplacer :

```typescript
export const messageTypeEnum = pgEnum('message_type', ['system', 'colonization', 'player']);
```

Par :

```typescript
export const messageTypeEnum = pgEnum('message_type', ['system', 'colonization', 'player', 'espionage', 'combat']);
```

- [ ] **Step 4: Modifier index.ts — export debris-fields**

Dans `packages/db/src/schema/index.ts`, ajouter :

```typescript
export * from './debris-fields.js';
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/debris-fields.ts packages/db/src/schema/fleet-events.ts packages/db/src/schema/messages.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add debris_fields table, recycle mission, combat/espionage message types"
```

---

## Chunk 3: Fleet Service Handlers — Spy + Recycle

### Task 6: processSpy handler

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Ajouter les imports nécessaires**

En haut de `apps/api/src/modules/fleet/fleet.service.ts`, ajouter aux imports existants de `@ogame-clone/db` :

```typescript
import { userResearch, debrisFields } from '@ogame-clone/db';
```

Ajouter les imports de `@ogame-clone/game-engine` (fusionner avec l'import existant) :

```typescript
import {
  calculateSpyReport,
  calculateDetectionChance,
  simulateCombat,
  calculateDebris,
  type CombatTechs,
  SHIP_STATS,
} from '@ogame-clone/game-engine';
```

Note : fusionner avec les imports `@ogame-clone/game-engine` déjà présents (`fleetSpeed`, `travelTime`, `distance`, `fuelConsumption`, `totalCargoCapacity`, `calculateMaxTemp`, `calculateMinTemp`, `calculateDiameter`, `calculateMaxFields`).

- [ ] **Step 2: Ajouter une méthode helper getCombatTechs**

Ajouter dans l'objet retourné par `createFleetService`, avant `getDriveTechs` :

```typescript
    async getCombatTechs(userId: string): Promise<CombatTechs> {
      const [research] = await db
        .select({
          weapons: userResearch.weapons,
          shielding: userResearch.shielding,
          armor: userResearch.armor,
        })
        .from(userResearch)
        .where(eq(userResearch.userId, userId))
        .limit(1);

      return {
        weapons: research?.weapons ?? 0,
        shielding: research?.shielding ?? 0,
        armor: research?.armor ?? 0,
      };
    },
```

- [ ] **Step 3: Ajouter getEspionageTech helper**

```typescript
    async getEspionageTech(userId: string): Promise<number> {
      const [research] = await db
        .select({ espionageTech: userResearch.espionageTech })
        .from(userResearch)
        .where(eq(userResearch.userId, userId))
        .limit(1);

      return research?.espionageTech ?? 0;
    },
```

- [ ] **Step 4: Implémenter processSpy**

Ajouter la méthode `processSpy` dans l'objet retourné par `createFleetService` :

```typescript
    async processSpy(
      event: typeof fleetEvents.$inferSelect,
      ships: Record<string, number>,
    ) {
      const probeCount = ships.espionageProbe ?? 0;
      const coords = `[${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}]`;

      // Get espionage tech levels
      const attackerTech = await this.getEspionageTech(event.userId);

      // Find target planet and its owner
      const [targetPlanet] = await db
        .select()
        .from(planets)
        .where(
          and(
            eq(planets.galaxy, event.targetGalaxy),
            eq(planets.system, event.targetSystem),
            eq(planets.position, event.targetPosition),
          ),
        )
        .limit(1);

      if (!targetPlanet) {
        // No planet at target
        if (messageService) {
          await messageService.createSystemMessage(
            event.userId,
            'espionage',
            `Espionnage ${coords}`,
            `Aucune planète trouvée à la position ${coords}.`,
          );
        }
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, 0, 0, 0,
        );
        return { mission: 'spy', success: false, reason: 'no_planet' };
      }

      const defenderTech = await this.getEspionageTech(targetPlanet.userId);

      // Calculate what's visible
      const visibility = calculateSpyReport(probeCount, attackerTech, defenderTech);

      // Build report body
      let body = `Rapport d'espionnage de ${coords}\n\n`;

      if (visibility.resources) {
        // Get current resources (use resourceService to sync first)
        await resourceService.syncPlanetResources(targetPlanet.id);
        const [planet] = await db.select().from(planets).where(eq(planets.id, targetPlanet.id)).limit(1);
        body += `**Ressources :**\nMétal : ${Math.floor(Number(planet.metal))}\nCristal : ${Math.floor(Number(planet.crystal))}\nDeutérium : ${Math.floor(Number(planet.deuterium))}\n\n`;
      }

      if (visibility.fleet) {
        const [ships] = await db.select().from(planetShips).where(eq(planetShips.planetId, targetPlanet.id)).limit(1);
        if (ships) {
          body += `**Flotte :**\n`;
          const shipTypes = ['smallCargo', 'largeCargo', 'lightFighter', 'heavyFighter', 'cruiser', 'battleship', 'espionageProbe', 'colonyShip', 'recycler'] as const;
          for (const t of shipTypes) {
            if (ships[t] > 0) body += `${t}: ${ships[t]}\n`;
          }
          body += '\n';
        }
      }

      if (visibility.defenses) {
        const [defs] = await db.select().from(planetDefenses).where(eq(planetDefenses.planetId, targetPlanet.id)).limit(1);
        if (defs) {
          body += `**Défenses :**\n`;
          const defTypes = ['rocketLauncher', 'lightLaser', 'heavyLaser', 'gaussCannon', 'plasmaTurret', 'smallShield', 'largeShield'] as const;
          for (const t of defTypes) {
            if (defs[t] > 0) body += `${t}: ${defs[t]}\n`;
          }
          body += '\n';
        }
      }

      if (visibility.buildings) {
        const [planet] = await db.select().from(planets).where(eq(planets.id, targetPlanet.id)).limit(1);
        body += `**Bâtiments :**\n`;
        const buildingCols = ['metalMineLevel', 'crystalMineLevel', 'deuteriumSynthesizerLevel', 'solarPlantLevel', 'roboticsFactoryLevel', 'shipyardLevel', 'researchLabLevel'] as const;
        for (const col of buildingCols) {
          if (planet[col] > 0) body += `${col}: ${planet[col]}\n`;
        }
        body += '\n';
      }

      if (visibility.research) {
        const [research] = await db.select().from(userResearch).where(eq(userResearch.userId, targetPlanet.userId)).limit(1);
        if (research) {
          body += `**Recherches :**\n`;
          const researchCols = ['espionageTech', 'computerTech', 'energyTech', 'combustion', 'impulse', 'hyperspaceDrive', 'weapons', 'shielding', 'armor'] as const;
          for (const col of researchCols) {
            if (research[col] > 0) body += `${col}: ${research[col]}\n`;
          }
        }
      }

      // Send report to attacker
      if (messageService) {
        await messageService.createSystemMessage(
          event.userId,
          'espionage',
          `Rapport d'espionnage ${coords}`,
          body,
        );
      }

      // Detection check
      const detectionChance = calculateDetectionChance(probeCount, attackerTech, defenderTech);
      const detected = Math.random() * 100 < detectionChance;

      if (detected) {
        // Probes destroyed, notify defender
        if (messageService) {
          const [attackerUser] = await db.select({ username: users.username }).from(users).where(eq(users.id, event.userId)).limit(1);
          await messageService.createSystemMessage(
            targetPlanet.userId,
            'espionage',
            `Activité d'espionnage détectée ${coords}`,
            `${probeCount} sonde(s) d'espionnage provenant de ${attackerUser?.username ?? 'Inconnu'} ont été détectées et détruites.`,
          );
        }
        // Mark event completed, no return
        await db
          .update(fleetEvents)
          .set({ status: 'completed' })
          .where(eq(fleetEvents.id, event.id));

        return { mission: 'spy', success: true, detected: true };
      }

      // Not detected: return probes
      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships, 0, 0, 0,
      );

      return { mission: 'spy', success: true, detected: false };
    },
```

- [ ] **Step 5: Implémenter processRecycle**

Ajouter la méthode `processRecycle` :

```typescript
    async processRecycle(
      event: typeof fleetEvents.$inferSelect,
      ships: Record<string, number>,
      metalCargo: number,
      crystalCargo: number,
      deuteriumCargo: number,
    ) {
      const coords = `[${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}]`;

      // Check for debris field
      const [debris] = await db
        .select()
        .from(debrisFields)
        .where(
          and(
            eq(debrisFields.galaxy, event.targetGalaxy),
            eq(debrisFields.system, event.targetSystem),
            eq(debrisFields.position, event.targetPosition),
          ),
        )
        .limit(1);

      if (!debris || (Number(debris.metal) <= 0 && Number(debris.crystal) <= 0)) {
        // No debris → return empty
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, metalCargo, crystalCargo, deuteriumCargo,
        );
        return { mission: 'recycle', collected: { metal: 0, crystal: 0 } };
      }

      // Calculate recycler cargo capacity
      const recyclerCount = ships.recycler ?? 0;
      const cargoPerRecycler = SHIP_STATS.recycler.cargoCapacity;
      const totalCargo = recyclerCount * cargoPerRecycler;

      // Collect: metal first, then crystal
      let remainingCargo = totalCargo;
      const availableMetal = Number(debris.metal);
      const availableCrystal = Number(debris.crystal);

      const collectedMetal = Math.min(availableMetal, remainingCargo);
      remainingCargo -= collectedMetal;
      const collectedCrystal = Math.min(availableCrystal, remainingCargo);

      // Update or delete debris field
      const newMetal = availableMetal - collectedMetal;
      const newCrystal = availableCrystal - collectedCrystal;

      if (newMetal <= 0 && newCrystal <= 0) {
        await db.delete(debrisFields).where(eq(debrisFields.id, debris.id));
      } else {
        await db
          .update(debrisFields)
          .set({
            metal: String(newMetal),
            crystal: String(newCrystal),
            updatedAt: new Date(),
          })
          .where(eq(debrisFields.id, debris.id));
      }

      // Return with collected resources
      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships,
        metalCargo + collectedMetal,
        crystalCargo + collectedCrystal,
        deuteriumCargo,
      );

      return { mission: 'recycle', collected: { metal: collectedMetal, crystal: collectedCrystal } };
    },
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.service.ts
git commit -m "feat(api): add processSpy and processRecycle handlers"
```

---

## Chunk 4: Fleet Service — Attack Handler + Routing

### Task 7: processAttack handler

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

- [ ] **Step 1: Implémenter processAttack**

Ajouter la méthode `processAttack` dans l'objet retourné par `createFleetService` :

```typescript
    async processAttack(
      event: typeof fleetEvents.$inferSelect,
      ships: Record<string, number>,
      metalCargo: number,
      crystalCargo: number,
      deuteriumCargo: number,
    ) {
      const coords = `[${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}]`;

      // Find target planet
      const [targetPlanet] = await db
        .select()
        .from(planets)
        .where(
          and(
            eq(planets.galaxy, event.targetGalaxy),
            eq(planets.system, event.targetSystem),
            eq(planets.position, event.targetPosition),
          ),
        )
        .limit(1);

      if (!targetPlanet) {
        // No planet → return fleet
        if (messageService) {
          await messageService.createSystemMessage(
            event.userId,
            'combat',
            `Attaque ${coords}`,
            `Aucune planète trouvée à la position ${coords}. Votre flotte fait demi-tour.`,
          );
        }
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, metalCargo, crystalCargo, deuteriumCargo,
        );
        return { mission: 'attack', success: false, reason: 'no_planet' };
      }

      // Get defender's ships and defenses
      const [defShips] = await db.select().from(planetShips).where(eq(planetShips.planetId, targetPlanet.id)).limit(1);
      const [defDefs] = await db.select().from(planetDefenses).where(eq(planetDefenses.planetId, targetPlanet.id)).limit(1);

      const defenderFleet: Record<string, number> = {};
      const defenderDefenses: Record<string, number> = {};
      const shipTypes = ['smallCargo', 'largeCargo', 'lightFighter', 'heavyFighter', 'cruiser', 'battleship', 'espionageProbe', 'colonyShip', 'recycler'] as const;
      const defenseTypes = ['rocketLauncher', 'lightLaser', 'heavyLaser', 'gaussCannon', 'plasmaTurret', 'smallShield', 'largeShield'] as const;

      if (defShips) {
        for (const t of shipTypes) {
          if (defShips[t] > 0) defenderFleet[t] = defShips[t];
        }
      }
      if (defDefs) {
        for (const t of defenseTypes) {
          if (defDefs[t] > 0) defenderDefenses[t] = defDefs[t];
        }
      }

      // Get combat techs
      const attackerTechs = await this.getCombatTechs(event.userId);
      const defenderTechs = await this.getCombatTechs(targetPlanet.userId);

      // Check if defender has anything to defend with
      const hasDefenders = Object.values(defenderFleet).some(v => v > 0) ||
                           Object.values(defenderDefenses).some(v => v > 0);

      let result;
      if (!hasDefenders) {
        // No combat needed, attacker wins by default
        result = {
          rounds: 0,
          outcome: 'attacker_wins' as const,
          attackerLosses: {} as Record<string, number>,
          defenderShipLosses: {} as Record<string, number>,
          defenderDefenseLosses: {} as Record<string, number>,
          debris: { metal: 0, crystal: 0 },
          defenderDefensesRepaired: {} as Record<string, number>,
        };
      } else {
        result = simulateCombat(ships, defenderFleet, defenderDefenses, attackerTechs, defenderTechs);
      }

      // Apply attacker losses
      const survivingShips: Record<string, number> = { ...ships };
      for (const [type, lost] of Object.entries(result.attackerLosses)) {
        survivingShips[type] = (survivingShips[type] ?? 0) - lost;
        if (survivingShips[type] <= 0) delete survivingShips[type];
      }

      // Apply defender ship losses
      if (defShips) {
        const shipUpdates: Record<string, number> = {};
        for (const t of shipTypes) {
          const lost = result.defenderShipLosses[t] ?? 0;
          if (lost > 0) shipUpdates[t] = defShips[t] - lost;
        }
        if (Object.keys(shipUpdates).length > 0) {
          await db.update(planetShips).set(shipUpdates).where(eq(planetShips.planetId, targetPlanet.id));
        }
      }

      // Apply defender defense losses (minus repairs)
      if (defDefs) {
        const defUpdates: Record<string, number> = {};
        for (const t of defenseTypes) {
          const lost = result.defenderDefenseLosses[t] ?? 0;
          const repaired = result.defenderDefensesRepaired[t] ?? 0;
          const netLoss = lost - repaired;
          if (netLoss > 0) defUpdates[t] = defDefs[t] - netLoss;
        }
        if (Object.keys(defUpdates).length > 0) {
          await db.update(planetDefenses).set(defUpdates).where(eq(planetDefenses.planetId, targetPlanet.id));
        }
      }

      // Create/accumulate debris field
      if (result.debris.metal > 0 || result.debris.crystal > 0) {
        const [existing] = await db
          .select()
          .from(debrisFields)
          .where(
            and(
              eq(debrisFields.galaxy, event.targetGalaxy),
              eq(debrisFields.system, event.targetSystem),
              eq(debrisFields.position, event.targetPosition),
            ),
          )
          .limit(1);

        if (existing) {
          await db
            .update(debrisFields)
            .set({
              metal: String(Number(existing.metal) + result.debris.metal),
              crystal: String(Number(existing.crystal) + result.debris.crystal),
              updatedAt: new Date(),
            })
            .where(eq(debrisFields.id, existing.id));
        } else {
          await db.insert(debrisFields).values({
            galaxy: event.targetGalaxy,
            system: event.targetSystem,
            position: event.targetPosition,
            metal: String(result.debris.metal),
            crystal: String(result.debris.crystal),
          });
        }
      }

      // Pillage resources if attacker wins
      let pillagedMetal = 0;
      let pillagedCrystal = 0;
      let pillagedDeuterium = 0;

      if (result.outcome === 'attacker_wins') {
        // Calculate remaining cargo capacity
        const remainingCargoCapacity = totalCargoCapacity(survivingShips);
        const availableCargo = remainingCargoCapacity - metalCargo - crystalCargo - deuteriumCargo;

        if (availableCargo > 0) {
          // Sync target planet resources
          await resourceService.syncPlanetResources(targetPlanet.id);
          const [updatedPlanet] = await db.select().from(planets).where(eq(planets.id, targetPlanet.id)).limit(1);

          const availMetal = Math.floor(Number(updatedPlanet.metal));
          const availCrystal = Math.floor(Number(updatedPlanet.crystal));
          const availDeut = Math.floor(Number(updatedPlanet.deuterium));

          // Take 1/3 of each, then fill remaining capacity
          const thirdCargo = Math.floor(availableCargo / 3);

          pillagedMetal = Math.min(availMetal, thirdCargo);
          pillagedCrystal = Math.min(availCrystal, thirdCargo);
          pillagedDeuterium = Math.min(availDeut, thirdCargo);

          let remaining = availableCargo - pillagedMetal - pillagedCrystal - pillagedDeuterium;

          // Fill remaining with available resources
          if (remaining > 0) {
            const extraMetal = Math.min(availMetal - pillagedMetal, remaining);
            pillagedMetal += extraMetal;
            remaining -= extraMetal;
          }
          if (remaining > 0) {
            const extraCrystal = Math.min(availCrystal - pillagedCrystal, remaining);
            pillagedCrystal += extraCrystal;
            remaining -= extraCrystal;
          }
          if (remaining > 0) {
            const extraDeut = Math.min(availDeut - pillagedDeuterium, remaining);
            pillagedDeuterium += extraDeut;
          }

          // Deduct from defender planet
          await db
            .update(planets)
            .set({
              metal: sql`${planets.metal} - ${pillagedMetal}`,
              crystal: sql`${planets.crystal} - ${pillagedCrystal}`,
              deuterium: sql`${planets.deuterium} - ${pillagedDeuterium}`,
            })
            .where(eq(planets.id, targetPlanet.id));
        }
      }

      // Send combat reports
      const outcomeText = result.outcome === 'attacker_wins' ? 'Victoire' :
                          result.outcome === 'defender_wins' ? 'Défaite' : 'Match nul';

      const reportBody = `Combat ${coords} — ${outcomeText}\n\n` +
        `Rounds : ${result.rounds}\n` +
        `Pertes attaquant : ${JSON.stringify(result.attackerLosses)}\n` +
        `Pertes défenseur (vaisseaux) : ${JSON.stringify(result.defenderShipLosses)}\n` +
        `Pertes défenseur (défenses) : ${JSON.stringify(result.defenderDefenseLosses)}\n` +
        `Défenses réparées : ${JSON.stringify(result.defenderDefensesRepaired)}\n` +
        `Débris : ${result.debris.metal} métal, ${result.debris.crystal} cristal\n` +
        (result.outcome === 'attacker_wins' ?
          `Pillage : ${pillagedMetal} métal, ${pillagedCrystal} cristal, ${pillagedDeuterium} deutérium\n` : '');

      if (messageService) {
        await messageService.createSystemMessage(
          event.userId,
          'combat',
          `Rapport de combat ${coords} — ${outcomeText}`,
          reportBody,
        );
        await messageService.createSystemMessage(
          targetPlanet.userId,
          'combat',
          `Rapport de combat ${coords} — ${result.outcome === 'attacker_wins' ? 'Défaite' : result.outcome === 'defender_wins' ? 'Victoire' : 'Match nul'}`,
          reportBody,
        );
      }

      // Return surviving fleet with cargo + pillage
      const hasShips = Object.values(survivingShips).some(v => v > 0);
      if (hasShips) {
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          survivingShips,
          metalCargo + pillagedMetal,
          crystalCargo + pillagedCrystal,
          deuteriumCargo + pillagedDeuterium,
        );
      } else {
        // All ships destroyed
        await db
          .update(fleetEvents)
          .set({ status: 'completed' })
          .where(eq(fleetEvents.id, event.id));
      }

      return { mission: 'attack', outcome: result.outcome };
    },
```

- [ ] **Step 2: Mettre à jour processArrival routing**

Dans `processArrival`, remplacer le bloc catch-all Phase 5b stub :

```typescript
      // For other missions (attack, spy) — Phase 5b
      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships, metalCargo, crystalCargo, deuteriumCargo,
      );

      return { mission: event.mission, placeholder: true };
```

Par :

```typescript
      if (event.mission === 'spy') {
        return this.processSpy(event, ships);
      }

      if (event.mission === 'attack') {
        return this.processAttack(event, ships, metalCargo, crystalCargo, deuteriumCargo);
      }

      if (event.mission === 'recycle') {
        return this.processRecycle(event, ships, metalCargo, crystalCargo, deuteriumCargo);
      }

      // Unknown mission — return fleet
      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships, metalCargo, crystalCargo, deuteriumCargo,
      );

      return { mission: event.mission, placeholder: true };
```

- [ ] **Step 3: Mettre à jour SendFleetInput — ajouter 'recycle'**

Dans le type `SendFleetInput` (en haut du fichier), modifier la ligne mission :

Avant :
```typescript
  mission: 'transport' | 'station' | 'spy' | 'attack' | 'colonize';
```

Après :
```typescript
  mission: 'transport' | 'station' | 'spy' | 'attack' | 'colonize' | 'recycle';
```

- [ ] **Step 4: Ajouter validation dans sendFleet**

Dans la méthode `sendFleet`, après les validations existantes (vérification des vaisseaux disponibles), ajouter :

```typescript
      // Validate: cannot attack own planet
      if (input.mission === 'attack') {
        const [targetPlanet] = await db
          .select({ userId: planets.userId })
          .from(planets)
          .where(
            and(
              eq(planets.galaxy, input.targetGalaxy),
              eq(planets.system, input.targetSystem),
              eq(planets.position, input.targetPosition),
            ),
          )
          .limit(1);
        if (targetPlanet && targetPlanet.userId === userId) {
          throw new Error('Vous ne pouvez pas attaquer votre propre planète');
        }
      }

      // Validate: recycle mission requires only recyclers
      if (input.mission === 'recycle') {
        for (const [shipType, count] of Object.entries(input.ships)) {
          if (count > 0 && shipType !== 'recycler') {
            throw new Error('Seuls les recycleurs peuvent être envoyés en mission recyclage');
          }
        }
      }
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.service.ts
git commit -m "feat(api): add processAttack handler with pillage, debris, and routing"
```

---

## Chunk 5: Frontend Updates

### Task 8: Galaxy page — debris indicator

**Files:**
- Modify: `apps/api/src/modules/galaxy/galaxy.service.ts`
- Modify: `apps/web/src/pages/Galaxy.tsx`

- [ ] **Step 1: Mettre à jour galaxy.service pour inclure les débris**

Dans `apps/api/src/modules/galaxy/galaxy.service.ts`, ajouter l'import :

```typescript
import { debrisFields } from '@ogame-clone/db';
```

Dans la méthode `getSystem`, après avoir construit le tableau des slots, ajouter une requête pour les débris du système :

```typescript
      // Fetch debris fields for this system
      const debris = await db
        .select()
        .from(debrisFields)
        .where(
          and(
            eq(debrisFields.galaxy, galaxy),
            eq(debrisFields.system, system),
          ),
        );

      // Attach debris to slots
      for (const d of debris) {
        const slot = slots[d.position - 1];
        if (slot) {
          slot.debris = { metal: Number(d.metal), crystal: Number(d.crystal) };
        }
      }
```

Et mettre à jour le type de retour des slots pour inclure `debris?: { metal: number; crystal: number }`.

- [ ] **Step 2: Mettre à jour Galaxy.tsx**

Dans `apps/web/src/pages/Galaxy.tsx`, ajouter un indicateur débris dans la ligne de chaque slot. Après le nom du joueur, ajouter :

```tsx
{slot.debris && (slot.debris.metal > 0 || slot.debris.crystal > 0) && (
  <span className="text-xs text-orange-400 ml-2" title={`Débris: ${slot.debris.metal.toLocaleString('fr-FR')} métal, ${slot.debris.crystal.toLocaleString('fr-FR')} cristal`}>
    DF
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/galaxy/galaxy.service.ts apps/web/src/pages/Galaxy.tsx
git commit -m "feat: show debris field indicator in galaxy view"
```

---

### Task 9: Fleet page — enable spy/attack/recycle missions

**Files:**
- Modify: `apps/web/src/pages/Fleet.tsx`

- [ ] **Step 1: Activer les missions dans le wizard**

Dans `apps/web/src/pages/Fleet.tsx`, la step 2 du wizard affiche les missions disponibles. Modifier la logique pour :

1. Toujours afficher spy, attack, recycle dans la liste des missions
2. Validation mission spy : au moins 1 `espionageProbe` sélectionnée
3. Validation mission attack : au moins 1 vaisseau de combat sélectionné (lightFighter, heavyFighter, cruiser, battleship)
4. Validation mission recycle : uniquement des recycleurs sélectionnés

Trouver la section qui liste les missions (probablement un select ou des boutons radio) et s'assurer que toutes les missions de l'enum sont listées. Si des missions étaient désactivées ou masquées, les activer.

Ajouter des messages de validation si la sélection de vaisseaux ne correspond pas à la mission.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Fleet.tsx
git commit -m "feat(web): enable spy, attack, and recycle missions in fleet wizard"
```

---

### Task 10: Messages page — add combat/espionage filters

**Files:**
- Modify: `apps/web/src/pages/Messages.tsx`

- [ ] **Step 1: Ajouter les filtres**

Dans `apps/web/src/pages/Messages.tsx`, s'il n'y a pas encore de filtres par type, ajouter des boutons de filtre au-dessus de l'inbox :

```tsx
const [typeFilter, setTypeFilter] = useState<string | undefined>();

// Filter buttons
<div className="flex gap-2 mb-3">
  {['Tous', 'Système', 'Joueur', 'Combat', 'Espionnage', 'Colonisation'].map((label) => {
    const value = label === 'Tous' ? undefined :
                  label === 'Système' ? 'system' :
                  label === 'Joueur' ? 'player' :
                  label === 'Combat' ? 'combat' :
                  label === 'Espionnage' ? 'espionage' :
                  'colonization';
    return (
      <Button
        key={label}
        variant={typeFilter === value ? 'default' : 'outline'}
        size="sm"
        onClick={() => setTypeFilter(value)}
      >
        {label}
      </Button>
    );
  })}
</div>
```

Passer `typeFilter` comme paramètre `type` à la query `inbox` si le router le supporte.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Messages.tsx
git commit -m "feat(web): add message type filters for combat and espionage"
```

---

## Chunk 6: Typecheck + Lint + Test

### Task 11: Vérification finale

- [ ] **Step 1: Turbo typecheck**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo typecheck
```
Expected: PASS

- [ ] **Step 2: Turbo lint**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo lint
```
Expected: PASS (fix any issues)

- [ ] **Step 3: Turbo test**

```bash
export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo test
```
Expected: ALL PASS — 102 tests existants + ~15 combat + ~9 espionage

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues from Phase 5b"
```

---

## Verification Checklist

1. `pnpm turbo typecheck` — pas d'erreur TS
2. `pnpm turbo test` — tous les tests passent (102 existants + ~24 nouveaux)
3. `pnpm turbo lint` — pas d'erreur lint
4. Handler attack : combat simulation, pertes, débris, pillage, messages aux deux joueurs
5. Handler spy : rapport selon nombre de sondes et tech, détection, messages
6. Handler recycle : collecte débris, retour avec cargo
7. Vue galaxie : indicateur débris visible
8. Fleet wizard : missions spy/attack/recycle activées avec validations
9. Messages : filtres combat/espionage fonctionnels
