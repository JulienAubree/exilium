import type { ResourceCost, BuildingCostDef } from './building-cost.js';

export interface ResearchCostDef {
  baseCost: { minerai: number; silicium: number; hydrogene: number };
  costFactor: number;
}

export function researchCost(def: ResearchCostDef, level: number): ResourceCost {
  const factor = Math.pow(def.costFactor, level - 1);
  return {
    minerai: Math.floor(def.baseCost.minerai * factor),
    silicium: Math.floor(def.baseCost.silicium * factor),
    hydrogene: Math.floor(def.baseCost.hydrogene * factor),
  };
}

export function researchTime(def: ResearchCostDef, level: number, labLevel: number): number {
  const cost = researchCost(def, level);
  const seconds = Math.floor(((cost.minerai + cost.silicium) / (1000 * (1 + labLevel))) * 3600);
  return Math.max(1, seconds);
}
