import type {
  CombatInput,
  CombatMultipliers,
  ShipCombatConfig,
} from '@exilium/game-engine';
import { buildCombatConfig } from '@exilium/game-engine';

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
    combatConfig: buildCombatConfig(gameConfig.universe),
    shipConfigs,
    shipCosts,
    shipIds,
    defenseIds,
    rngSeed,
  };
}
