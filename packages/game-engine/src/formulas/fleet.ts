import type { Coordinates } from '@exilium/shared';

export interface ShipStats {
  baseSpeed: number;
  fuelConsumption: number;
  cargoCapacity: number;
  driveType: 'combustion' | 'impulse' | 'hyperspaceDrive';
  miningExtraction: number;
}

export interface FleetConfig {
  galaxyFactor: number;
  systemBase: number;
  systemFactor: number;
  positionBase: number;
  positionFactor: number;
  samePositionDistance: number;
  speedFactor: number;
}

const DEFAULT_FLEET_CONFIG: FleetConfig = {
  galaxyFactor: 20000,
  systemBase: 2700,
  systemFactor: 95,
  positionBase: 1000,
  positionFactor: 5,
  samePositionDistance: 5,
  speedFactor: 35000,
};

export function shipSpeed(stats: ShipStats, speedMultiplier: number): number {
  return Math.floor(stats.baseSpeed * speedMultiplier);
}

export function fleetSpeed(
  ships: Record<string, number>,
  shipStatsMap: Record<string, ShipStats>,
  speedMultipliers: Record<string, number>,
): number {
  let minSpeed = Infinity;
  for (const [shipId, count] of Object.entries(ships)) {
    if (count > 0) {
      const stats = shipStatsMap[shipId];
      if (!stats) continue;
      const multiplier = speedMultipliers[shipId] ?? 1;
      const speed = shipSpeed(stats, multiplier);
      if (speed < minSpeed) minSpeed = speed;
    }
  }
  return minSpeed === Infinity ? 0 : minSpeed;
}

export function distance(origin: Coordinates, target: Coordinates, config: FleetConfig = DEFAULT_FLEET_CONFIG): number {
  if (origin.galaxy !== target.galaxy) {
    return config.galaxyFactor * Math.abs(origin.galaxy - target.galaxy);
  }
  if (origin.system !== target.system) {
    return config.systemBase + config.systemFactor * Math.abs(origin.system - target.system);
  }
  if (origin.position !== target.position) {
    return config.positionBase + config.positionFactor * Math.abs(origin.position - target.position);
  }
  return config.samePositionDistance;
}

export function travelTime(
  origin: Coordinates,
  target: Coordinates,
  speed: number,
  universeSpeed: number,
  config: FleetConfig = DEFAULT_FLEET_CONFIG,
): number {
  const dist = distance(origin, target, config);
  return Math.round(10 + (config.speedFactor / speed) * Math.sqrt((dist * 10) / universeSpeed));
}

export function fuelConsumption(
  ships: Record<string, number>,
  dist: number,
  duration: number,
  shipStatsMap: Record<string, ShipStats>,
  config: { speedFactor: number } = { speedFactor: 35000 },
): number {
  let total = 0;
  for (const [shipId, count] of Object.entries(ships)) {
    if (count > 0) {
      const stats = shipStatsMap[shipId];
      if (!stats) continue;
      const speedFac = duration <= 10 ? 1 : (duration + 10) / (duration - 10);
      const consumption = stats.fuelConsumption * count * (dist / config.speedFactor) * speedFac;
      total += Math.max(1, Math.round(consumption));
    }
  }
  return Math.max(1, Math.ceil(total));
}

export function totalCargoCapacity(
  ships: Record<string, number>,
  shipStatsMap: Record<string, ShipStats>,
): number {
  let total = 0;
  for (const [shipId, count] of Object.entries(ships)) {
    if (count > 0) {
      const stats = shipStatsMap[shipId];
      if (stats) total += stats.cargoCapacity * count;
    }
  }
  return total;
}

/**
 * Compute the total mining extraction capacity of a fleet.
 * Only ships with miningExtraction > 0 contribute (e.g. prospectors).
 */
export function totalMiningExtraction(
  ships: Record<string, number>,
  shipStatsMap: Record<string, ShipStats>,
): number {
  let total = 0;
  for (const [shipId, count] of Object.entries(ships)) {
    if (count > 0) {
      const stats = shipStatsMap[shipId];
      if (stats && stats.miningExtraction > 0) total += stats.miningExtraction * count;
    }
  }
  return total;
}
