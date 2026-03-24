export interface UnitCombatStats {
  weapons: number;
  shield: number;
  armor: number;
}

export interface CombatMultipliers {
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
  attackerShips: Record<string, number>;
  defenderShips: Record<string, number>;
}

export interface CombatResult {
  rounds: RoundResult[];
  outcome: 'attacker' | 'defender' | 'draw';
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  debris: { minerai: number; silicium: number };
  repairedDefenses: Record<string, number>;
}

export interface CombatConfig {
  maxRounds: number;
  bounceThreshold: number;
  rapidDestructionThreshold: number;
  repairProbability: number;
}

const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  maxRounds: 6,
  bounceThreshold: 0.01,
  rapidDestructionThreshold: 0.3,
  repairProbability: 0.7,
};

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

function countSurvivingByType(units: CombatUnit[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) {
    if (!unit.destroyed) {
      counts[unit.type] = (counts[unit.type] ?? 0) + 1;
    }
  }
  return counts;
}

function fireAtTarget(attacker: CombatUnit, target: CombatUnit, config: CombatConfig): void {
  if (attacker.destroyed || target.destroyed) return;

  const damage = attacker.weapons;

  // Bounce: if damage < bounceThreshold% of target's max shield, no damage dealt
  if (damage < config.bounceThreshold * target.maxShield) return;

  // Shield absorbs first
  if (target.shield >= damage) {
    target.shield -= damage;
  } else {
    const remaining = damage - target.shield;
    target.shield = 0;
    target.armor -= remaining;
  }

  // Rapid destruction: if hull <= rapidDestructionThreshold% of max, unit is destroyed
  if (target.armor <= 0 || target.armor <= config.rapidDestructionThreshold * target.maxArmor) {
    target.destroyed = true;
    target.armor = 0;
  }
}

function executeRound(
  attackers: CombatUnit[],
  defenders: CombatUnit[],
  rapidFireMap: Record<string, Record<string, number>>,
  config: CombatConfig,
): void {
  const aliveAttackers = attackers.filter((u) => !u.destroyed);
  const aliveDefenders = defenders.filter((u) => !u.destroyed);

  // Attackers fire
  for (const attacker of aliveAttackers) {
    if (aliveDefenders.length === 0) break;
    let target = aliveDefenders[Math.floor(Math.random() * aliveDefenders.length)];
    fireAtTarget(attacker, target, config);

    // Rapid fire
    const rf = rapidFireMap[attacker.type];
    if (rf) {
      let keepFiring = true;
      while (keepFiring) {
        const rfValue = rf[target.type];
        if (rfValue && Math.random() < (rfValue - 1) / rfValue) {
          const stillAlive = aliveDefenders.filter((u) => !u.destroyed);
          if (stillAlive.length === 0) break;
          target = stillAlive[Math.floor(Math.random() * stillAlive.length)];
          fireAtTarget(attacker, target, config);
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
    fireAtTarget(defender, target, config);

    // Rapid fire for defenders
    const rf = rapidFireMap[defender.type];
    if (rf) {
      let keepFiring = true;
      let currentTarget = target;
      while (keepFiring) {
        const rfValue = rf[currentTarget.type];
        if (rfValue && Math.random() < (rfValue - 1) / rfValue) {
          const stillAlive = attackers.filter((u) => !u.destroyed);
          if (stillAlive.length === 0) break;
          currentTarget = stillAlive[Math.floor(Math.random() * stillAlive.length)];
          fireAtTarget(defender, currentTarget, config);
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
  shipIds: Set<string>,
  shipCosts: Record<string, { minerai: number; silicium: number }>,
  debrisRatio = 0.3,
): { minerai: number; silicium: number } {
  let minerai = 0;
  let silicium = 0;

  // Only ships contribute to debris, not defenses
  for (const [type, count] of Object.entries(attackerLosses)) {
    if (shipIds.has(type)) {
      const cost = shipCosts[type];
      if (cost) {
        minerai += cost.minerai * count;
        silicium += cost.silicium * count;
      }
    }
  }

  for (const [type, count] of Object.entries(defenderLosses)) {
    if (shipIds.has(type)) {
      const cost = shipCosts[type];
      if (cost) {
        minerai += cost.minerai * count;
        silicium += cost.silicium * count;
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
  repairProbability: number = 0.7,
): Record<string, number> {
  const repaired: Record<string, number> = {};

  for (const [type, count] of Object.entries(defenderLosses)) {
    if (defenseIds.has(type)) {
      let repairedCount = 0;
      for (let i = 0; i < count; i++) {
        if (Math.random() < repairProbability) {
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
  attackerMultipliers: CombatMultipliers,
  defenderMultipliers: CombatMultipliers,
  combatStats: Record<string, UnitCombatStats>,
  rapidFireMap: Record<string, Record<string, number>>,
  shipIds: Set<string>,
  shipCosts: Record<string, { minerai: number; silicium: number }>,
  defenseIds: Set<string>,
  debrisRatio = 0.3,
  combatConfig: CombatConfig = DEFAULT_COMBAT_CONFIG,
): CombatResult {
  const attackers = createUnits(attackerFleet, attackerMultipliers, combatStats);
  const defenders = createUnits(defenderFleet, defenderMultipliers, combatStats);

  const rounds: RoundResult[] = [];

  for (let round = 1; round <= combatConfig.maxRounds; round++) {
    executeRound(attackers, defenders, rapidFireMap, combatConfig);

    const attackersRemaining = attackers.filter((u) => !u.destroyed).length;
    const defendersRemaining = defenders.filter((u) => !u.destroyed).length;

    rounds.push({
      round,
      attackersRemaining,
      defendersRemaining,
      attackerShips: countSurvivingByType(attackers),
      defenderShips: countSurvivingByType(defenders),
    });

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

  const debris = calculateDebris(attackerLosses, defenderLosses, shipIds, shipCosts, debrisRatio);
  const repairedDefenses = repairDefenses(defenderLosses, defenseIds, combatConfig.repairProbability);

  return {
    rounds,
    outcome,
    attackerLosses,
    defenderLosses,
    debris,
    repairedDefenses,
  };
}
