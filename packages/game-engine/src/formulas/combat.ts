import { COMBAT_STATS, RAPID_FIRE } from '../constants/combat-stats.js';
import { SHIPS, type ShipId } from '../constants/ships.js';
import { DEFENSES, type DefenseId } from '../constants/defenses.js';

export interface CombatTechs {
  weapons: number;
  shielding: number;
  armor: number;
}

interface CombatUnit {
  type: string;
  weapons: number;
  shield: number;
  maxShield: number;
  armor: number;
  maxArmor: number;
  destroyed: boolean;
}

export interface RoundResult {
  round: number;
  attackersRemaining: number;
  defendersRemaining: number;
}

export interface CombatResult {
  rounds: RoundResult[];
  outcome: 'attacker' | 'defender' | 'draw';
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  debris: { metal: number; crystal: number };
  repairedDefenses: Record<string, number>;
}

function isShipId(id: string): id is ShipId {
  return id in SHIPS;
}

function isDefenseId(id: string): id is DefenseId {
  return id in DEFENSES;
}

function createUnits(
  fleet: Record<string, number>,
  techs: CombatTechs,
): CombatUnit[] {
  const units: CombatUnit[] = [];
  for (const [type, count] of Object.entries(fleet)) {
    const base = COMBAT_STATS[type];
    if (!base) continue;
    for (let i = 0; i < count; i++) {
      const weapons = base.weapons * (1 + 0.1 * techs.weapons);
      const shield = base.shield * (1 + 0.1 * techs.shielding);
      const armor = base.armor * (1 + 0.1 * techs.armor);
      units.push({
        type,
        weapons,
        shield,
        maxShield: shield,
        armor,
        maxArmor: armor,
        destroyed: false,
      });
    }
  }
  return units;
}

function fireAtTarget(attacker: CombatUnit, target: CombatUnit): void {
  if (attacker.destroyed || target.destroyed) return;

  const damage = attacker.weapons;

  // Bounce: if damage < 1% of target's max shield, no damage dealt
  if (damage < 0.01 * target.maxShield) return;

  // Shield absorbs first
  if (target.shield >= damage) {
    target.shield -= damage;
  } else {
    const remaining = damage - target.shield;
    target.shield = 0;
    target.armor -= remaining;
  }

  // Rapid destruction: if hull <= 30% of max, unit is destroyed
  if (target.armor <= 0 || target.armor <= 0.3 * target.maxArmor) {
    target.destroyed = true;
    target.armor = 0;
  }
}

function executeRound(
  attackers: CombatUnit[],
  defenders: CombatUnit[],
): void {
  const aliveAttackers = attackers.filter((u) => !u.destroyed);
  const aliveDefenders = defenders.filter((u) => !u.destroyed);

  // Attackers fire
  for (const attacker of aliveAttackers) {
    if (aliveDefenders.length === 0) break;
    let target = aliveDefenders[Math.floor(Math.random() * aliveDefenders.length)];
    fireAtTarget(attacker, target);

    // Rapid fire
    const rf = RAPID_FIRE[attacker.type];
    if (rf) {
      let keepFiring = true;
      while (keepFiring) {
        const rfValue = rf[target.type];
        if (rfValue && Math.random() < (rfValue - 1) / rfValue) {
          const stillAlive = aliveDefenders.filter((u) => !u.destroyed);
          if (stillAlive.length === 0) break;
          target = stillAlive[Math.floor(Math.random() * stillAlive.length)];
          fireAtTarget(attacker, target);
        } else {
          keepFiring = false;
        }
      }
    }
  }

  // Defenders fire
  for (const defender of aliveDefenders) {
    if (defender.destroyed) continue;
    const alive = attackers.filter((u) => !u.destroyed);
    if (alive.length === 0) break;
    const target = alive[Math.floor(Math.random() * alive.length)];
    fireAtTarget(defender, target);

    // Rapid fire for defenders
    const rf = RAPID_FIRE[defender.type];
    if (rf) {
      let keepFiring = true;
      let currentTarget = target;
      while (keepFiring) {
        const rfValue = rf[currentTarget.type];
        if (rfValue && Math.random() < (rfValue - 1) / rfValue) {
          const stillAlive = attackers.filter((u) => !u.destroyed);
          if (stillAlive.length === 0) break;
          currentTarget = stillAlive[Math.floor(Math.random() * stillAlive.length)];
          fireAtTarget(defender, currentTarget);
        } else {
          keepFiring = false;
        }
      }
    }
  }

  // Shields regenerate at end of round
  for (const unit of [...attackers, ...defenders]) {
    if (!unit.destroyed) {
      unit.shield = unit.maxShield;
    }
  }
}

export function calculateDebris(
  attackerLosses: Record<string, number>,
  defenderLosses: Record<string, number>,
): { metal: number; crystal: number } {
  let metal = 0;
  let crystal = 0;

  // Only ships contribute to debris, not defenses
  for (const [type, count] of Object.entries(attackerLosses)) {
    if (isShipId(type)) {
      const cost = SHIPS[type].cost;
      metal += cost.metal * count;
      crystal += cost.crystal * count;
    }
  }

  for (const [type, count] of Object.entries(defenderLosses)) {
    if (isShipId(type)) {
      const cost = SHIPS[type].cost;
      metal += cost.metal * count;
      crystal += cost.crystal * count;
    }
  }

  return {
    metal: Math.floor(metal * 0.3),
    crystal: Math.floor(crystal * 0.3),
  };
}

export function repairDefenses(
  defenderLosses: Record<string, number>,
): Record<string, number> {
  const repaired: Record<string, number> = {};

  for (const [type, count] of Object.entries(defenderLosses)) {
    if (isDefenseId(type)) {
      let repairedCount = 0;
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.7) {
          repairedCount++;
        }
      }
      if (repairedCount > 0) {
        repaired[type] = repairedCount;
      }
    }
  }

  return repaired;
}

export function simulateCombat(
  attackerFleet: Record<string, number>,
  defenderFleet: Record<string, number>,
  attackerTechs: CombatTechs,
  defenderTechs: CombatTechs,
): CombatResult {
  const attackers = createUnits(attackerFleet, attackerTechs);
  const defenders = createUnits(defenderFleet, defenderTechs);

  const rounds: RoundResult[] = [];
  const maxRounds = 6;

  for (let round = 1; round <= maxRounds; round++) {
    executeRound(attackers, defenders);

    const attackersRemaining = attackers.filter((u) => !u.destroyed).length;
    const defendersRemaining = defenders.filter((u) => !u.destroyed).length;

    rounds.push({ round, attackersRemaining, defendersRemaining });

    if (attackersRemaining === 0 || defendersRemaining === 0) break;
  }

  const lastRound = rounds[rounds.length - 1];
  let outcome: 'attacker' | 'defender' | 'draw';
  if (lastRound.attackersRemaining > 0 && lastRound.defendersRemaining === 0) {
    outcome = 'attacker';
  } else if (lastRound.attackersRemaining === 0 && lastRound.defendersRemaining > 0) {
    outcome = 'defender';
  } else {
    outcome = 'draw';
  }

  // Calculate losses
  const attackerLosses: Record<string, number> = {};
  for (const unit of attackers) {
    if (unit.destroyed) {
      attackerLosses[unit.type] = (attackerLosses[unit.type] ?? 0) + 1;
    }
  }

  const defenderLosses: Record<string, number> = {};
  for (const unit of defenders) {
    if (unit.destroyed) {
      defenderLosses[unit.type] = (defenderLosses[unit.type] ?? 0) + 1;
    }
  }

  const debris = calculateDebris(attackerLosses, defenderLosses);
  const repairedDefenses = repairDefenses(defenderLosses);

  return {
    rounds,
    outcome,
    attackerLosses,
    defenderLosses,
    debris,
    repairedDefenses,
  };
}
