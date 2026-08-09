import { universeNumber } from './config.js';

export interface Resources { minerai: number; silicium: number; hydrogene: number }
export interface BuildOrder { buildingId: string; targetLevel: number; completesAt: number }
export interface ResearchOrder { researchId: string; targetLevel: number; completesAt: number }
export interface ShipBuildOrder { shipId: string; completesAt: number }
export interface SimState {
  timeSec: number;
  resources: Resources;
  levels: Map<string, number>;
  techLevels: Map<string, number>;
  build: BuildOrder | null;
  research: ResearchOrder | null;
  ships: Map<string, number>;
  shipBuild: ShipBuildOrder | null;
}

// Dotation de départ, alignée sur le seed (startingMinerai / startingSilicium /
// startingHydrogene). Le simulateur partait de 500/500/0 alors que le jeu donne
// 500/300/100 : il démarrait avec 200 silicium de trop et sans hydrogène.
export const STARTING_RESOURCES: Resources = {
  minerai: universeNumber('startingMinerai', 500),
  silicium: universeNumber('startingSilicium', 300),
  hydrogene: universeNumber('startingHydrogene', 100),
};

export function initState(): SimState {
  return { timeSec: 0, resources: { ...STARTING_RESOURCES }, levels: new Map(), techLevels: new Map(), build: null, research: null, ships: new Map(), shipBuild: null };
}
