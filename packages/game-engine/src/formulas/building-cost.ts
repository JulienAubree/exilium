export interface ResourceCost {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

export interface BuildingCostDef {
  baseCost: { minerai: number; silicium: number; hydrogene: number };
  costFactor: number;
}

/**
 * Cost to build a building at a given level.
 * Formula: baseCost * costFactor^(level-1)
 */
export function buildingCost(def: BuildingCostDef, level: number): ResourceCost {
  const factor = Math.pow(def.costFactor, level - 1);
  return {
    minerai: Math.floor(def.baseCost.minerai * factor),
    silicium: Math.floor(def.baseCost.silicium * factor),
    hydrogene: Math.floor(def.baseCost.hydrogene * factor),
  };
}

/**
 * Construction time in seconds.
 * Formula: (mineraiCost + siliciumCost) / (2500 * (1 + roboticsLevel)) * 3600
 * Minimum 1 second.
 */
export function buildingTime(def: BuildingCostDef, level: number, roboticsLevel: number): number {
  const cost = buildingCost(def, level);
  const seconds = Math.floor(((cost.minerai + cost.silicium) / (2500 * (1 + roboticsLevel))) * 3600);
  return Math.max(1, seconds);
}
