export interface Resources { minerai: number; silicium: number; hydrogene: number }
export interface BuildOrder { buildingId: string; targetLevel: number; completesAt: number }
export interface SimState {
  timeSec: number;
  resources: Resources;
  levels: Map<string, number>;
  build: BuildOrder | null;
}

// Dotation de départ (à aligner sur le seed des nouveaux empires ; valeur de départ MVP).
export const STARTING_RESOURCES: Resources = { minerai: 500, silicium: 500, hydrogene: 0 };

export function initState(): SimState {
  return { timeSec: 0, resources: { ...STARTING_RESOURCES }, levels: new Map(), build: null };
}
