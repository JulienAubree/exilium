import { BUILDINGS } from '../constants/buildings.js';
import { RESEARCH } from '../constants/research.js';
import { SHIPS } from '../constants/ships.js';
import { DEFENSES } from '../constants/defenses.js';

export function calculateBuildingPoints(levels: Record<string, number>): number {
  let totalResources = 0;

  for (const [, def] of Object.entries(BUILDINGS)) {
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

export function calculateResearchPoints(levels: Record<string, number>): number {
  let totalResources = 0;

  for (const [, def] of Object.entries(RESEARCH)) {
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

export function calculateFleetPoints(counts: Record<string, number>): number {
  let totalResources = 0;

  for (const [shipId, def] of Object.entries(SHIPS)) {
    const count = counts[def.countColumn] ?? counts[shipId] ?? 0;
    if (count > 0) {
      totalResources += count * (def.cost.metal + def.cost.crystal + def.cost.deuterium);
    }
  }

  return Math.floor(totalResources / 1000);
}

export function calculateDefensePoints(counts: Record<string, number>): number {
  let totalResources = 0;

  for (const [defenseId, def] of Object.entries(DEFENSES)) {
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
