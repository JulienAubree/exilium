export type EmpireViewMode = 'resources' | 'fleet';

export interface PlanetFleetData {
  ships: { id: string; name: string; count: number; role: string | null; cargoCapacity: number }[];
  totalShips: number;
  totalFP: number;
  totalCargo: number;
}
