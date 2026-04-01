import type { GameConfig, ShipConfig, BuildingConfig, PlanetTypeConfig } from '../modules/admin/game-config.service.js';

export function findShipByRole(config: GameConfig, role: string): ShipConfig {
  const ship = Object.values(config.ships).find((s) => s.role === role);
  if (!ship) throw new Error(`No ship with role "${role}" found in config`);
  return ship;
}

export function findShipsByRole(config: GameConfig, role: string): ShipConfig[] {
  const ships = Object.values(config.ships).filter((s) => s.role === role);
  if (ships.length === 0) throw new Error(`No ship with role "${role}" found in config`);
  return ships;
}

export function findBuildingByRole(config: GameConfig, role: string): BuildingConfig {
  const building = Object.values(config.buildings).find((b) => b.role === role);
  if (!building) throw new Error(`No building with role "${role}" found in config`);
  return building;
}

export function findPlanetTypeByRole(config: GameConfig, role: string): PlanetTypeConfig {
  const pt = config.planetTypes.find((p) => p.role === role);
  if (!pt) throw new Error(`No planet type with role "${role}" found in config`);
  return pt;
}
