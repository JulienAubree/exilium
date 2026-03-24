import type { ProductionConfig } from '@ogame-clone/game-engine';

export function buildProductionConfig(gameConfig: { production: Record<string, any>; universe: Record<string, unknown> }): ProductionConfig {
  const mc = gameConfig.production['mineraiMine'];
  const sc = gameConfig.production['siliciumMine'];
  const hc = gameConfig.production['hydrogeneSynth'];
  const sp = gameConfig.production['solarPlant'];
  return {
    minerai: { baseProduction: mc?.baseProduction ?? 30, exponentBase: mc?.exponentBase ?? 1.1 },
    silicium: { baseProduction: sc?.baseProduction ?? 20, exponentBase: sc?.exponentBase ?? 1.1 },
    hydrogene: {
      baseProduction: hc?.baseProduction ?? 10, exponentBase: hc?.exponentBase ?? 1.1,
      tempCoeffA: hc?.tempCoeffA ?? 1.36, tempCoeffB: hc?.tempCoeffB ?? 0.004,
    },
    solar: { baseProduction: sp?.baseProduction ?? 20, exponentBase: sp?.exponentBase ?? 1.1 },
    mineraiEnergy: { baseConsumption: mc?.energyConsumption ?? 10, exponentBase: mc?.exponentBase ?? 1.1 },
    siliciumEnergy: { baseConsumption: sc?.energyConsumption ?? 10, exponentBase: sc?.exponentBase ?? 1.1 },
    hydrogeneEnergy: { baseConsumption: hc?.energyConsumption ?? 20, exponentBase: hc?.exponentBase ?? 1.1 },
    storage: {
      storageBase: Number(gameConfig.universe.storage_base) || 5000,
      coeffA: Number(gameConfig.universe.storage_coeff_a) || 2.5,
      coeffB: Number(gameConfig.universe.storage_coeff_b) || 20,
      coeffC: Number(gameConfig.universe.storage_coeff_c) || 33,
    },
    satellite: {
      homePlanetEnergy: Number(gameConfig.universe.satellite_home_planet_energy) || 50,
      baseDivisor: Number(gameConfig.universe.satellite_base_divisor) || 4,
      baseOffset: Number(gameConfig.universe.satellite_base_offset) || 20,
    },
  };
}
