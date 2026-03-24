import { getPhaseMultiplier } from '../constants/progression.js';

export interface ResourceCost {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

export interface BuildingCostDef {
  baseCost: { minerai: number; silicium: number; hydrogene: number };
  costFactor: number;
  baseTime: number;
}

/**
 * Cost to build a building at a given level.
 * Formula: baseCost * costFactor^(level-1) * phaseMultiplier(level)
 */
export function buildingCost(def: BuildingCostDef, level: number, phaseMap?: Record<number, number>): ResourceCost {
  const factor = Math.pow(def.costFactor, level - 1) * getPhaseMultiplier(level, phaseMap);
  return {
    minerai: Math.floor(def.baseCost.minerai * factor),
    silicium: Math.floor(def.baseCost.silicium * factor),
    hydrogene: Math.floor(def.baseCost.hydrogene * factor),
  };
}

/**
 * Construction time in seconds.
 * Formula: baseTime * costFactor^(level-1) * bonusMultiplier * phaseMultiplier(level)
 * @param bonusMultiplier - result of resolveBonus('building_time', null, ...)
 * Minimum 1 second.
 */
export function buildingTime(def: BuildingCostDef, level: number, bonusMultiplier: number, phaseMap?: Record<number, number>): number {
  const seconds = Math.floor(def.baseTime * Math.pow(def.costFactor, level - 1) * bonusMultiplier * getPhaseMultiplier(level, phaseMap));
  return Math.max(1, seconds);
}
