import { BUILDINGS, PRODUCTION_CONFIG } from '@exilium/db';
import type { BuildingCostDef } from '@exilium/game-engine';

export interface BuildingDef {
  id: string;
  costDef: BuildingCostDef;
  maxLevel: number;
  role: string | null;
  prerequisites: { buildingId: string; level: number }[];
}
export interface ProductionConfig { baseProduction: number; exponentBase: number; energyConsumption: number | null }

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
    m.set(p.id, { baseProduction: p.baseProduction, exponentBase: p.exponentBase, energyConsumption: p.energyConsumption ?? null });
  }
  return m;
}
