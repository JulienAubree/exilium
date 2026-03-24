import { getPhaseMultiplier, type ResourceCost } from './building-cost.js';

export interface ResearchCostDef {
  baseCost: { minerai: number; silicium: number; hydrogene: number };
  costFactor: number;
}

export function researchCost(def: ResearchCostDef, level: number, phaseMap?: Record<number, number>): ResourceCost {
  const factor = Math.pow(def.costFactor, level - 1) * getPhaseMultiplier(level, phaseMap);
  return {
    minerai: Math.floor(def.baseCost.minerai * factor),
    silicium: Math.floor(def.baseCost.silicium * factor),
    hydrogene: Math.floor(def.baseCost.hydrogene * factor),
  };
}

/**
 * Research time in seconds.
 * @param bonusMultiplier - result of resolveBonus('research_time', null, ...)
 */
export function researchTime(def: ResearchCostDef, level: number, bonusMultiplier: number, config: { timeDivisor: number; phaseMap?: Record<number, number> } = { timeDivisor: 1000 }): number {
  const cost = researchCost(def, level, config.phaseMap);
  const seconds = Math.floor(((cost.minerai + cost.silicium) / config.timeDivisor) * 3600 * bonusMultiplier * getPhaseMultiplier(level, config.phaseMap));
  return Math.max(1, seconds);
}
