import {
  metalProduction,
  crystalProduction,
  deuteriumProduction,
  solarPlantEnergy,
  metalMineEnergy,
  crystalMineEnergy,
  deutSynthEnergy,
  storageCapacity,
  calculateProductionFactor,
} from './production.js';

export interface PlanetLevels {
  metalMineLevel: number;
  crystalMineLevel: number;
  deutSynthLevel: number;
  solarPlantLevel: number;
  storageMetalLevel: number;
  storageCrystalLevel: number;
  storageDeutLevel: number;
  maxTemp: number;
  metalMinePercent?: number;
  crystalMinePercent?: number;
  deutSynthPercent?: number;
}

export interface ProductionRates {
  metalPerHour: number;
  crystalPerHour: number;
  deutPerHour: number;
  productionFactor: number;
  energyProduced: number;
  energyConsumed: number;
  metalMineEnergyConsumption: number;
  crystalMineEnergyConsumption: number;
  deutSynthEnergyConsumption: number;
  metalMinePercent: number;
  crystalMinePercent: number;
  deutSynthPercent: number;
  storageMetalCapacity: number;
  storageCrystalCapacity: number;
  storageDeutCapacity: number;
}

export function calculateProductionRates(planet: PlanetLevels): ProductionRates {
  const metalPct = (planet.metalMinePercent ?? 100) / 100;
  const crystalPct = (planet.crystalMinePercent ?? 100) / 100;
  const deutPct = (planet.deutSynthPercent ?? 100) / 100;

  const energyProduced = solarPlantEnergy(planet.solarPlantLevel);

  const metalEnergy = Math.floor(metalMineEnergy(planet.metalMineLevel) * metalPct);
  const crystalEnergy = Math.floor(crystalMineEnergy(planet.crystalMineLevel) * crystalPct);
  const deutEnergy = Math.floor(deutSynthEnergy(planet.deutSynthLevel) * deutPct);
  const energyConsumed = metalEnergy + crystalEnergy + deutEnergy;

  const factor = calculateProductionFactor(energyProduced, energyConsumed);

  return {
    metalPerHour: metalProduction(planet.metalMineLevel, metalPct * factor),
    crystalPerHour: crystalProduction(planet.crystalMineLevel, crystalPct * factor),
    deutPerHour: deuteriumProduction(planet.deutSynthLevel, planet.maxTemp, deutPct * factor),
    productionFactor: factor,
    energyProduced,
    energyConsumed,
    metalMineEnergyConsumption: metalEnergy,
    crystalMineEnergyConsumption: crystalEnergy,
    deutSynthEnergyConsumption: deutEnergy,
    metalMinePercent: planet.metalMinePercent ?? 100,
    crystalMinePercent: planet.crystalMinePercent ?? 100,
    deutSynthPercent: planet.deutSynthPercent ?? 100,
    storageMetalCapacity: storageCapacity(planet.storageMetalLevel),
    storageCrystalCapacity: storageCapacity(planet.storageCrystalLevel),
    storageDeutCapacity: storageCapacity(planet.storageDeutLevel),
  };
}

export interface PlanetResources extends PlanetLevels {
  metal: number;
  crystal: number;
  deuterium: number;
}

/**
 * Calculate current resources with lazy production since last update.
 * Caps resources at storage capacity.
 */
export function calculateResources(
  planet: PlanetResources,
  resourcesUpdatedAt: Date,
  now: Date,
): { metal: number; crystal: number; deuterium: number } {
  const rates = calculateProductionRates(planet);
  const elapsedHours = Math.max(0, (now.getTime() - resourcesUpdatedAt.getTime()) / (3600 * 1000));

  const metal = Math.min(
    planet.metal + Math.floor(rates.metalPerHour * elapsedHours),
    rates.storageMetalCapacity,
  );
  const crystal = Math.min(
    planet.crystal + Math.floor(rates.crystalPerHour * elapsedHours),
    rates.storageCrystalCapacity,
  );
  const deuterium = Math.min(
    planet.deuterium + Math.floor(rates.deutPerHour * elapsedHours),
    rates.storageDeutCapacity,
  );

  return { metal, crystal, deuterium };
}
