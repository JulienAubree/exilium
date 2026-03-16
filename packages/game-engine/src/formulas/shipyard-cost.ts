import type { ResourceCost } from './building-cost.js';

export interface UnitCostDef {
  cost: { metal: number; crystal: number; deuterium: number };
}

export function shipCost(def: UnitCostDef): ResourceCost {
  return { ...def.cost };
}

export function shipTime(def: UnitCostDef, shipyardLevel: number): number {
  const seconds = Math.floor(((def.cost.metal + def.cost.crystal) / (2500 * (1 + shipyardLevel))) * 3600);
  return Math.max(1, seconds);
}

export function defenseCost(def: UnitCostDef): ResourceCost {
  return { ...def.cost };
}

export function defenseTime(def: UnitCostDef, shipyardLevel: number): number {
  const seconds = Math.floor(((def.cost.metal + def.cost.crystal) / (2500 * (1 + shipyardLevel))) * 3600);
  return Math.max(1, seconds);
}
