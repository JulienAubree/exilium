import {
  buildingCost, buildingTime,
  mineraiProduction, siliciumProduction, hydrogeneProduction,
  calculateProductionFactor,
  solarPlantEnergy, mineraiMineEnergy, siliciumMineEnergy, hydrogeneSynthEnergy,
} from '@exilium/game-engine';
import type { BuildingDef, ProductionConfig } from './config.js';
import type { SimState, Resources } from './state.js';

// Default temperature for the simulated home planet (temperate ~50°C).
// The simulator works on a single virtual planet; temperature affects hydrogene production.
const DEFAULT_MAX_TEMP = 50;

export class SimEngine {
  constructor(
    private buildings: Map<string, BuildingDef>,
    private prod: Map<string, ProductionConfig>,
  ) {}

  /** Facteur énergie : solaire produite / énergie consommée (via les formules game-engine). */
  private energyFactor(state: SimState): number {
    const lvl = (id: string) => state.levels.get(id) ?? 0;
    const solarCfg = this.prod.get('solarPlant')!;
    const produced = solarPlantEnergy(lvl('solarPlant'), { baseProduction: solarCfg.baseProduction, exponentBase: solarCfg.exponentBase });
    const consumed =
      mineraiMineEnergy(lvl('mineraiMine')) +
      siliciumMineEnergy(lvl('siliciumMine')) +
      hydrogeneSynthEnergy(lvl('hydrogeneSynth'));
    return calculateProductionFactor(produced, consumed);
  }

  /** Production horaire {minerai, silicium, hydrogene}. */
  production(state: SimState): Resources {
    const f = this.energyFactor(state);
    const lvl = (id: string) => state.levels.get(id) ?? 0;
    const cfg = (id: string) => this.prod.get(id)!;
    return {
      minerai: mineraiProduction(lvl('mineraiMine'), f, cfg('mineraiMine')),
      silicium: siliciumProduction(lvl('siliciumMine'), f, cfg('siliciumMine')),
      hydrogene: hydrogeneProduction(lvl('hydrogeneSynth'), DEFAULT_MAX_TEMP, f, cfg('hydrogeneSynth') as any),
    };
  }

  costOf(buildingId: string, level: number): Resources {
    return buildingCost(this.buildings.get(buildingId)!.costDef, level);
  }

  /** Heures avant d'accumuler `cost` au taux actuel ; Infinity si une ressource manquante a prod ≤ 0. */
  timeToAfford(state: SimState, cost: Resources): number {
    const rate = this.production(state);
    let maxHours = 0;
    for (const k of ['minerai', 'silicium', 'hydrogene'] as const) {
      const missing = cost[k] - state.resources[k];
      if (missing <= 0) continue;
      if (rate[k] <= 0) return Infinity;
      maxHours = Math.max(maxHours, missing / rate[k]);
    }
    return maxHours;
  }

  /** Lance la construction du prochain niveau (attend les ressources si besoin via advance). */
  startBuild(state: SimState, buildingId: string): void {
    const target = (state.levels.get(buildingId) ?? 0) + 1;
    const cost = this.costOf(buildingId, target);
    const waitH = this.timeToAfford(state, cost);
    if (!isFinite(waitH)) throw new Error(`inatteignable: ${buildingId} niv.${target}`);
    if (waitH > 0) this.advance(state, waitH * 3600);
    state.resources.minerai -= cost.minerai;
    state.resources.silicium -= cost.silicium;
    state.resources.hydrogene -= cost.hydrogene;
    const dur = buildingTime(this.buildings.get(buildingId)!.costDef, target, 1);
    state.build = { buildingId, targetLevel: target, completesAt: state.timeSec + dur };
  }

  /** Secondes jusqu'au prochain événement = fin de la construction en cours (ou 0 si rien). */
  nextEventIn(state: SimState): number {
    return state.build ? Math.max(0, state.build.completesAt - state.timeSec) : 0;
  }

  /** Avance le temps de `seconds` : accumule les ressources, finalise la construction si due. */
  advance(state: SimState, seconds: number): void {
    if (seconds <= 0) return;
    const rate = this.production(state);
    state.resources.minerai += (rate.minerai * seconds) / 3600;
    state.resources.silicium += (rate.silicium * seconds) / 3600;
    state.resources.hydrogene += (rate.hydrogene * seconds) / 3600;
    state.timeSec += seconds;
    if (state.build && state.timeSec >= state.build.completesAt) {
      state.levels.set(state.build.buildingId, state.build.targetLevel);
      state.build = null;
    }
  }
}
