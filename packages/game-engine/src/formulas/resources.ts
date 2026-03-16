import {
  mineraiProduction,
  siliciumProduction,
  hydrogeneProduction,
  solarPlantEnergy,
  mineraiMineEnergy,
  siliciumMineEnergy,
  hydrogeneSynthEnergy,
  storageCapacity,
  calculateProductionFactor,
} from './production.js';

export interface PlanetLevels {
  mineraiMineLevel: number;
  siliciumMineLevel: number;
  hydrogeneSynthLevel: number;
  solarPlantLevel: number;
  storageMineraiLevel: number;
  storageSiliciumLevel: number;
  storageHydrogeneLevel: number;
  maxTemp: number;
  mineraiMinePercent?: number;
  siliciumMinePercent?: number;
  hydrogeneSynthPercent?: number;
}

export interface ProductionRates {
  mineraiPerHour: number;
  siliciumPerHour: number;
  hydrogenePerHour: number;
  productionFactor: number;
  energyProduced: number;
  energyConsumed: number;
  mineraiMineEnergyConsumption: number;
  siliciumMineEnergyConsumption: number;
  hydrogeneSynthEnergyConsumption: number;
  mineraiMinePercent: number;
  siliciumMinePercent: number;
  hydrogeneSynthPercent: number;
  storageMineraiCapacity: number;
  storageSiliciumCapacity: number;
  storageHydrogeneCapacity: number;
}

export function calculateProductionRates(planet: PlanetLevels): ProductionRates {
  const mineraiPct = (planet.mineraiMinePercent ?? 100) / 100;
  const siliciumPct = (planet.siliciumMinePercent ?? 100) / 100;
  const hydrogenePct = (planet.hydrogeneSynthPercent ?? 100) / 100;

  const energyProduced = solarPlantEnergy(planet.solarPlantLevel);

  const mineraiEnergy = Math.floor(mineraiMineEnergy(planet.mineraiMineLevel) * mineraiPct);
  const siliciumEnergy = Math.floor(siliciumMineEnergy(planet.siliciumMineLevel) * siliciumPct);
  const hydrogeneEnergy = Math.floor(hydrogeneSynthEnergy(planet.hydrogeneSynthLevel) * hydrogenePct);
  const energyConsumed = mineraiEnergy + siliciumEnergy + hydrogeneEnergy;

  const factor = calculateProductionFactor(energyProduced, energyConsumed);

  return {
    mineraiPerHour: mineraiProduction(planet.mineraiMineLevel, mineraiPct * factor),
    siliciumPerHour: siliciumProduction(planet.siliciumMineLevel, siliciumPct * factor),
    hydrogenePerHour: hydrogeneProduction(planet.hydrogeneSynthLevel, planet.maxTemp, hydrogenePct * factor),
    productionFactor: factor,
    energyProduced,
    energyConsumed,
    mineraiMineEnergyConsumption: mineraiEnergy,
    siliciumMineEnergyConsumption: siliciumEnergy,
    hydrogeneSynthEnergyConsumption: hydrogeneEnergy,
    mineraiMinePercent: planet.mineraiMinePercent ?? 100,
    siliciumMinePercent: planet.siliciumMinePercent ?? 100,
    hydrogeneSynthPercent: planet.hydrogeneSynthPercent ?? 100,
    storageMineraiCapacity: storageCapacity(planet.storageMineraiLevel),
    storageSiliciumCapacity: storageCapacity(planet.storageSiliciumLevel),
    storageHydrogeneCapacity: storageCapacity(planet.storageHydrogeneLevel),
  };
}

export interface PlanetResources extends PlanetLevels {
  minerai: number;
  silicium: number;
  hydrogene: number;
}

/**
 * Calculate current resources with lazy production since last update.
 * Caps resources at storage capacity.
 */
export function calculateResources(
  planet: PlanetResources,
  resourcesUpdatedAt: Date,
  now: Date,
): { minerai: number; silicium: number; hydrogene: number } {
  const rates = calculateProductionRates(planet);
  const elapsedHours = Math.max(0, (now.getTime() - resourcesUpdatedAt.getTime()) / (3600 * 1000));

  const minerai = Math.min(
    planet.minerai + Math.floor(rates.mineraiPerHour * elapsedHours),
    rates.storageMineraiCapacity,
  );
  const silicium = Math.min(
    planet.silicium + Math.floor(rates.siliciumPerHour * elapsedHours),
    rates.storageSiliciumCapacity,
  );
  const hydrogene = Math.min(
    planet.hydrogene + Math.floor(rates.hydrogenePerHour * elapsedHours),
    rates.storageHydrogeneCapacity,
  );

  return { minerai, silicium, hydrogene };
}
