import { BUILDINGS, PRODUCTION_CONFIG, RESEARCH, BONUS_DEFINITIONS, SHIPS } from '@exilium/db';
import type { BuildingCostDef, ResearchCostDef, BonusDefinition } from '@exilium/game-engine';

export interface BuildingDef {
  id: string;
  costDef: BuildingCostDef;
  maxLevel: number;
  role: string | null;
  prerequisites: { buildingId: string; level: number }[];
}
export interface ProductionConfig {
  baseProduction: number;
  exponentBase: number;
  energyConsumption: number | null;
  tempCoeffA: number | null;
  tempCoeffB: number | null;
}

export function loadBuildings(): Map<string, BuildingDef> {
  const m = new Map<string, BuildingDef>();
  for (const b of BUILDINGS as any[]) {
    m.set(b.id, {
      id: b.id,
      costDef: {
        baseCost: { minerai: b.baseCostMinerai, silicium: b.baseCostSilicium, hydrogene: b.baseCostHydrogene },
        costFactor: b.costFactor,
        baseTime: b.baseTime,
      },
      maxLevel: b.maxLevel,
      role: b.role ?? null,
      prerequisites: b.prerequisites ?? [],
    });
  }
  return m;
}

export function loadProductionConfig(): Map<string, ProductionConfig> {
  const m = new Map<string, ProductionConfig>();
  for (const p of PRODUCTION_CONFIG as any[]) {
    m.set(p.id, {
      baseProduction: p.baseProduction,
      exponentBase: p.exponentBase,
      energyConsumption: p.energyConsumption ?? null,
      tempCoeffA: p.tempCoeffA ?? null,
      tempCoeffB: p.tempCoeffB ?? null,
    });
  }
  return m;
}

export interface ResearchDef {
  id: string;
  costDef: ResearchCostDef;
  maxLevel: number | null;
  prereqBuildings: { buildingId: string; level: number }[];
  prereqResearch: { researchId: string; level: number }[];
}

export function loadResearch(): Map<string, ResearchDef> {
  const m = new Map<string, ResearchDef>();
  for (const r of RESEARCH as any[]) {
    m.set(r.id, {
      id: r.id,
      costDef: {
        baseCost: { minerai: r.baseCostMinerai, silicium: r.baseCostSilicium, hydrogene: r.baseCostHydrogene },
        costFactor: r.costFactor,
      },
      maxLevel: r.maxLevel ?? null,
      prereqBuildings: r.prerequisites?.buildings ?? [],
      prereqResearch: r.prerequisites?.research ?? [],
    });
  }
  return m;
}

export function loadBonuses(): BonusDefinition[] {
  return BONUS_DEFINITIONS as BonusDefinition[];
}

export interface ShipDef {
  id: string;
  cost: { minerai: number; silicium: number; hydrogene: number };
  prereqBuildings: { buildingId: string; level: number }[];
  prereqResearch: { researchId: string; level: number }[];
}

export function loadShips(): Map<string, ShipDef> {
  const m = new Map<string, ShipDef>();
  for (const r of SHIPS as any[]) {
    m.set(r.id, {
      id: r.id,
      cost: { minerai: r.costMinerai, silicium: r.costSilicium, hydrogene: r.costHydrogene },
      prereqBuildings: r.prerequisites?.buildings ?? [],
      prereqResearch: r.prerequisites?.research ?? [],
    });
  }
  return m;
}
