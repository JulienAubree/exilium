import type { ResourceCost, BuildingCostDef } from './building-cost.js';

export interface ResearchCostDef {
  baseCost: { metal: number; crystal: number; deuterium: number };
  costFactor: number;
}

export function researchCost(def: ResearchCostDef, level: number): ResourceCost {
  const factor = Math.pow(def.costFactor, level - 1);
  return {
    metal: Math.floor(def.baseCost.metal * factor),
    crystal: Math.floor(def.baseCost.crystal * factor),
    deuterium: Math.floor(def.baseCost.deuterium * factor),
  };
}

export function researchTime(def: ResearchCostDef, level: number, labLevel: number): number {
  const cost = researchCost(def, level);
  const seconds = Math.floor(((cost.metal + cost.crystal) / (1000 * (1 + labLevel))) * 3600);
  return Math.max(1, seconds);
}
