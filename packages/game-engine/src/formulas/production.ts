/**
 * Minerai mine production per hour.
 * Formula: baseProduction * level * exponentBase^level * productionFactor
 */
export function mineraiProduction(
  level: number,
  productionFactor: number = 1,
  config: { baseProduction: number; exponentBase: number } = { baseProduction: 30, exponentBase: 1.1 },
): number {
  return Math.floor(config.baseProduction * level * Math.pow(config.exponentBase, level) * productionFactor);
}

/**
 * Silicium mine production per hour.
 * Formula: baseProduction * level * exponentBase^level * productionFactor
 */
export function siliciumProduction(
  level: number,
  productionFactor: number = 1,
  config: { baseProduction: number; exponentBase: number } = { baseProduction: 20, exponentBase: 1.1 },
): number {
  return Math.floor(config.baseProduction * level * Math.pow(config.exponentBase, level) * productionFactor);
}

/**
 * Hydrogen synthesizer production per hour.
 * Formula: baseProduction * level * exponentBase^level * (tempCoeffA - tempCoeffB * maxTemp) * productionFactor
 */
export function hydrogeneProduction(
  level: number,
  maxTemp: number,
  productionFactor: number = 1,
  config: { baseProduction: number; exponentBase: number; tempCoeffA: number; tempCoeffB: number } = { baseProduction: 10, exponentBase: 1.1, tempCoeffA: 1.36, tempCoeffB: 0.004 },
): number {
  return Math.floor(config.baseProduction * level * Math.pow(config.exponentBase, level) * (config.tempCoeffA - config.tempCoeffB * maxTemp) * productionFactor);
}

/**
 * Solar plant energy production.
 * Formula: baseProduction * level * exponentBase^level
 */
export function solarPlantEnergy(
  level: number,
  config: { baseProduction: number; exponentBase: number } = { baseProduction: 20, exponentBase: 1.1 },
): number {
  return Math.floor(config.baseProduction * level * Math.pow(config.exponentBase, level));
}

/**
 * Minerai mine energy consumption.
 * Formula: baseConsumption * level * exponentBase^level
 */
export function mineraiMineEnergy(
  level: number,
  config: { baseConsumption: number; exponentBase: number } = { baseConsumption: 10, exponentBase: 1.1 },
): number {
  return Math.floor(config.baseConsumption * level * Math.pow(config.exponentBase, level));
}

/**
 * Silicium mine energy consumption.
 * Formula: baseConsumption * level * exponentBase^level
 */
export function siliciumMineEnergy(
  level: number,
  config: { baseConsumption: number; exponentBase: number } = { baseConsumption: 10, exponentBase: 1.1 },
): number {
  return Math.floor(config.baseConsumption * level * Math.pow(config.exponentBase, level));
}

/**
 * Hydrogen synthesizer energy consumption.
 * Formula: baseConsumption * level * exponentBase^level
 */
export function hydrogeneSynthEnergy(
  level: number,
  config: { baseConsumption: number; exponentBase: number } = { baseConsumption: 20, exponentBase: 1.1 },
): number {
  return Math.floor(config.baseConsumption * level * Math.pow(config.exponentBase, level));
}

/**
 * Storage capacity for minerai, silicium, or hydrogene.
 * Formula: storageBase * floor(coeffA * e^(coeffB * level / coeffC))
 */
export function storageCapacity(
  level: number,
  config: { storageBase: number; coeffA: number; coeffB: number; coeffC: number } = { storageBase: 5000, coeffA: 2.5, coeffB: 20, coeffC: 33 },
): number {
  return config.storageBase * Math.floor(config.coeffA * Math.exp((config.coeffB * level) / config.coeffC));
}

/**
 * Effective storage capacity = min(theoretical, capHours × hourlyProduction).
 *
 * Sprint 1 of the 5-pillar rebalance : the theoretical exponential storage
 * formula scales much faster than production, leaving vétérans with rooms
 * that hold 100× their hourly output (purely anti-pillage, never a tradeoff).
 *
 * The effective cap ties storage to a duration of production — by default
 * `capHoursFactor=24`, so the storage can hold up to 24h of production. A
 * player away for a full day doesn't lose anything, and upgrading mines
 * actually expands stockage horizon at the same time.
 *
 * When `hourlyProduction` is 0 the cap returns the theoretical floor
 * (avoids new players being locked at 0 capacity before their mines start).
 */
export function effectiveStorageCapacity(
  level: number,
  hourlyProduction: number,
  capHoursFactor: number = 24,
  config?: { storageBase: number; coeffA: number; coeffB: number; coeffC: number },
): number {
  const theoretical = storageCapacity(level, config);
  if (hourlyProduction <= 0) return theoretical;
  const productionBasedCap = Math.floor(hourlyProduction * capHoursFactor);
  // Floor cap to the theoretical level-1 value so a starting player isn't
  // crushed by their own ramp-up.
  const floor = storageCapacity(1, config);
  return Math.max(floor, Math.min(theoretical, productionBasedCap));
}

/**
 * Calculate the production factor based on energy balance.
 * If energy produced >= energy consumed, factor is 1.
 * Otherwise, factor is produced / consumed.
 * If consumed is 0, factor is 1.
 */
export function calculateProductionFactor(energyProduced: number, energyConsumed: number): number {
  if (energyConsumed === 0) return 1;
  if (energyProduced >= energyConsumed) return 1;
  return energyProduced / energyConsumed;
}

/**
 * Solar satellite energy production per unit.
 * Home planet: always homePlanetEnergy.
 * Other planets: max(10, floor(maxTemp / baseDivisor) + baseOffset)
 */
export function solarSatelliteEnergy(
  maxTemp: number,
  isHomePlanet: boolean = false,
  config: { homePlanetEnergy: number; baseDivisor: number; baseOffset: number } = { homePlanetEnergy: 50, baseDivisor: 4, baseOffset: 20 },
): number {
  if (isHomePlanet) return config.homePlanetEnergy;
  return Math.max(10, Math.floor(maxTemp / config.baseDivisor) + config.baseOffset);
}
