import type {
  CombatInput,
  CombatConfig,
  CombatMultipliers,
  ShipCombatConfig,
  ShipCategory,
} from '@ogame-clone/game-engine';

/** Combat categories — mirrors apps/api/src/modules/fleet/handlers/attack.handler.ts */
const COMBAT_CATEGORIES: ShipCategory[] = [
  { id: 'light', name: 'Léger', targetable: true, targetOrder: 1 },
  { id: 'medium', name: 'Moyen', targetable: true, targetOrder: 2 },
  { id: 'heavy', name: 'Lourd', targetable: true, targetOrder: 3 },
  { id: 'support', name: 'Support', targetable: false, targetOrder: 4 },
];

const NEUTRAL_MULTIPLIERS: CombatMultipliers = { weapons: 1, shielding: 1, armor: 1 };

interface ShipConfigLike {
  weapons: number;
  shield: number;
  hull: number;
  baseArmor: number;
  shotCount: number;
  combatCategoryId: string | null;
  cost?: { minerai: number; silicium: number };
  costMinerai?: number;
  costSilicium?: number;
}

interface GameConfigLike {
  ships: Record<string, ShipConfigLike>;
  defenses: Record<string, ShipConfigLike>;
  universe: Record<string, unknown>;
}

export function buildShipCombatConfigs(
  gameConfig: GameConfigLike,
): Record<string, ShipCombatConfig> {
  const configs: Record<string, ShipCombatConfig> = {};
  for (const [id, ship] of Object.entries(gameConfig.ships)) {
    configs[id] = {
      shipType: id,
      categoryId: ship.combatCategoryId ?? 'support',
      baseShield: ship.shield,
      baseArmor: ship.baseArmor,
      baseHull: ship.hull,
      baseWeaponDamage: ship.weapons,
      baseShotCount: ship.shotCount,
    };
  }
  for (const [id, def] of Object.entries(gameConfig.defenses)) {
    configs[id] = {
      shipType: id,
      categoryId: def.combatCategoryId ?? 'heavy',
      baseShield: def.shield,
      baseArmor: def.baseArmor,
      baseHull: def.hull,
      baseWeaponDamage: def.weapons,
      baseShotCount: def.shotCount,
    };
  }
  return configs;
}

export function buildCombatConfig(gameConfig: GameConfigLike): CombatConfig {
  const u = gameConfig.universe;
  return {
    maxRounds: Number(u['combat_max_rounds']) || 4,
    debrisRatio: Number(u['combat_debris_ratio']) || 0.3,
    defenseRepairRate: Number(u['combat_defense_repair_rate']) || 0.7,
    pillageRatio: Number(u['combat_pillage_ratio']) || 0.33,
    minDamagePerHit: Number(u['combat_min_damage_per_hit']) || 1,
    researchBonusPerLevel: Number(u['combat_research_bonus_per_level']) || 0.1,
    categories: COMBAT_CATEGORIES,
  };
}

function getShipCosts(
  gameConfig: GameConfigLike,
): Record<string, { minerai: number; silicium: number }> {
  const costs: Record<string, { minerai: number; silicium: number }> = {};
  for (const [id, ship] of Object.entries(gameConfig.ships)) {
    costs[id] = {
      minerai: ship.cost?.minerai ?? ship.costMinerai ?? 0,
      silicium: ship.cost?.silicium ?? ship.costSilicium ?? 0,
    };
  }
  for (const [id, def] of Object.entries(gameConfig.defenses)) {
    costs[id] = {
      minerai: def.cost?.minerai ?? def.costMinerai ?? 0,
      silicium: def.cost?.silicium ?? def.costSilicium ?? 0,
    };
  }
  return costs;
}

/**
 * Build a complete CombatInput from gameConfig and fleet compositions.
 * Uses neutral multipliers (1/1/1) and 'light' as default target priority.
 */
export function buildCombatInput(
  attackerFleet: Record<string, number>,
  defenderFleet: Record<string, number>,
  gameConfig: GameConfigLike,
  rngSeed?: number,
): CombatInput {
  const shipConfigs = buildShipCombatConfigs(gameConfig);
  const shipCosts = getShipCosts(gameConfig);
  const shipIds = new Set(Object.keys(gameConfig.ships));
  const defenseIds = new Set(Object.keys(gameConfig.defenses));

  return {
    attackerFleet,
    defenderFleet,
    defenderDefenses: {},
    attackerMultipliers: NEUTRAL_MULTIPLIERS,
    defenderMultipliers: NEUTRAL_MULTIPLIERS,
    attackerTargetPriority: 'light',
    defenderTargetPriority: 'light',
    combatConfig: buildCombatConfig(gameConfig),
    shipConfigs,
    shipCosts,
    shipIds,
    defenseIds,
    rngSeed,
  };
}
