import type { ResourceCost } from './building-cost.js';

export interface UnitCostDef {
  cost: { minerai: number; silicium: number; hydrogene: number };
}

export function shipCost(def: UnitCostDef): ResourceCost {
  return { ...def.cost };
}

/**
 * @param bonusMultiplier - result of resolveBonus('ship_build_time', buildCategory, ...)
 */
export function shipTime(def: UnitCostDef, bonusMultiplier: number): number {
  const seconds = Math.floor(((def.cost.minerai + def.cost.silicium) / 2500) * 3600 * bonusMultiplier);
  return Math.max(1, seconds);
}

export function defenseCost(def: UnitCostDef): ResourceCost {
  return { ...def.cost };
}

/**
 * @param bonusMultiplier - result of resolveBonus('defense_build_time', null, ...)
 */
export function defenseTime(def: UnitCostDef, bonusMultiplier: number): number {
  const seconds = Math.floor(((def.cost.minerai + def.cost.silicium) / 2500) * 3600 * bonusMultiplier);
  return Math.max(1, seconds);
}
