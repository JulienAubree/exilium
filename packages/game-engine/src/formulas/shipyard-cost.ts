import type { ResourceCost } from './building-cost.js';

export interface UnitCostDef {
  cost: { minerai: number; silicium: number; hydrogene: number };
}

export function unitCost(def: UnitCostDef): ResourceCost {
  return { ...def.cost };
}

/** @deprecated Use unitCost instead */
export const shipCost = unitCost;
/** @deprecated Use unitCost instead */
export const defenseCost = unitCost;

/**
 * @param bonusMultiplier - result of resolveBonus for build time
 */
export function unitTime(def: UnitCostDef, bonusMultiplier: number, timeDivisor: number = 2500): number {
  const seconds = Math.floor(((def.cost.minerai + def.cost.silicium) / timeDivisor) * 3600 * bonusMultiplier);
  return Math.max(1, seconds);
}

/** @deprecated Use unitTime instead */
export const shipTime = unitTime;
/** @deprecated Use unitTime instead */
export const defenseTime = unitTime;
