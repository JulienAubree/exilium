export interface BuildingDef {
  levelColumn: string;
  baseCost: { metal: number; crystal: number; deuterium: number };
  costFactor: number;
}

export interface ResearchDef {
  levelColumn: string;
  baseCost: { metal: number; crystal: number; deuterium: number };
  costFactor: number;
}

export interface UnitDef {
  countColumn: string;
  cost: { metal: number; crystal: number; deuterium: number };
}

export function calculateBuildingPoints(
  levels: Record<string, number>,
  buildingDefs: Record<string, BuildingDef>,
): number {
  let totalResources = 0;

  for (const [, def] of Object.entries(buildingDefs)) {
    const level = levels[def.levelColumn] ?? 0;
    for (let l = 1; l <= level; l++) {
      const factor = Math.pow(def.costFactor, l - 1);
      totalResources += Math.floor(def.baseCost.metal * factor)
        + Math.floor(def.baseCost.crystal * factor)
        + Math.floor(def.baseCost.deuterium * factor);
    }
  }

  return Math.floor(totalResources / 1000);
}

export function calculateResearchPoints(
  levels: Record<string, number>,
  researchDefs: Record<string, ResearchDef>,
): number {
  let totalResources = 0;

  for (const [, def] of Object.entries(researchDefs)) {
    const level = levels[def.levelColumn] ?? 0;
    for (let l = 1; l <= level; l++) {
      const factor = Math.pow(def.costFactor, l - 1);
      totalResources += Math.floor(def.baseCost.metal * factor)
        + Math.floor(def.baseCost.crystal * factor)
        + Math.floor(def.baseCost.deuterium * factor);
    }
  }

  return Math.floor(totalResources / 1000);
}

export function calculateFleetPoints(
  counts: Record<string, number>,
  shipDefs: Record<string, UnitDef>,
): number {
  let totalResources = 0;

  for (const [shipId, def] of Object.entries(shipDefs)) {
    const count = counts[def.countColumn] ?? counts[shipId] ?? 0;
    if (count > 0) {
      totalResources += count * (def.cost.metal + def.cost.crystal + def.cost.deuterium);
    }
  }

  return Math.floor(totalResources / 1000);
}

export function calculateDefensePoints(
  counts: Record<string, number>,
  defenseDefs: Record<string, UnitDef>,
): number {
  let totalResources = 0;

  for (const [defenseId, def] of Object.entries(defenseDefs)) {
    const count = counts[def.countColumn] ?? counts[defenseId] ?? 0;
    if (count > 0) {
      totalResources += count * (def.cost.metal + def.cost.crystal + def.cost.deuterium);
    }
  }

  return Math.floor(totalResources / 1000);
}

export function calculateTotalPoints(
  buildingPoints: number,
  researchPoints: number,
  fleetPoints: number,
  defensePoints: number,
): number {
  return buildingPoints + researchPoints + fleetPoints + defensePoints;
}
