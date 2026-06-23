import {
  buildingCost, buildingTime,
  mineraiProduction, siliciumProduction, hydrogeneProduction,
  calculateProductionFactor,
  solarPlantEnergy, mineraiMineEnergy, siliciumMineEnergy, hydrogeneSynthEnergy,
  resolveBonus,
  researchCost, researchTime,
  unitCost, unitTime,
} from '@exilium/game-engine';
import type { BonusDefinition } from '@exilium/game-engine';
import type { BuildingDef, ProductionConfig, ResearchDef, ShipDef } from './config.js';
import type { SimState, Resources } from './state.js';

// Default temperature for the simulated home planet (temperate ~50°C).
// The simulator works on a single virtual planet; temperature affects hydrogene production.
const DEFAULT_MAX_TEMP = 50;

export class SimEngine {
  constructor(
    private buildings: Map<string, BuildingDef>,
    private prod: Map<string, ProductionConfig>,
    private bonuses: BonusDefinition[] = [],
    private research: Map<string, ResearchDef> = new Map(),
    private ships: Map<string, ShipDef> = new Map(),
  ) {}

  /** Converts state.techLevels Map to a plain Record for resolveBonus. */
  private techObj(state: SimState): Record<string, number> {
    return Object.fromEntries(state.techLevels);
  }

  /** Facteur énergie : solaire produite / énergie consommée (via les formules game-engine). */
  private energyFactor(state: SimState): number {
    const lvl = (id: string) => state.levels.get(id) ?? 0;
    const tech = this.techObj(state);
    const solarCfg = this.prod.get('solarPlant')!;
    const rawProduced = solarPlantEnergy(lvl('solarPlant'), { baseProduction: solarCfg.baseProduction, exponentBase: solarCfg.exponentBase });
    const produced = rawProduced * resolveBonus('energy_production', null, tech, this.bonuses);
    const rawConsumed =
      mineraiMineEnergy(lvl('mineraiMine')) +
      siliciumMineEnergy(lvl('siliciumMine')) +
      hydrogeneSynthEnergy(lvl('hydrogeneSynth'));
    const consumed = rawConsumed * resolveBonus('energy_consumption', null, tech, this.bonuses);
    return calculateProductionFactor(produced, consumed);
  }

  /** Production horaire {minerai, silicium, hydrogene}. */
  production(state: SimState): Resources {
    const f = this.energyFactor(state);
    const lvl = (id: string) => state.levels.get(id) ?? 0;
    const cfg = (id: string) => this.prod.get(id)!;
    const tech = this.techObj(state);
    return {
      minerai: Math.floor(mineraiProduction(lvl('mineraiMine'), f, cfg('mineraiMine')) * resolveBonus('production_minerai', null, tech, this.bonuses)),
      silicium: Math.floor(siliciumProduction(lvl('siliciumMine'), f, cfg('siliciumMine')) * resolveBonus('production_silicium', null, tech, this.bonuses)),
      hydrogene: Math.floor(hydrogeneProduction(lvl('hydrogeneSynth'), DEFAULT_MAX_TEMP, f, {
        baseProduction: cfg('hydrogeneSynth').baseProduction,
        exponentBase: cfg('hydrogeneSynth').exponentBase,
        tempCoeffA: cfg('hydrogeneSynth').tempCoeffA ?? 1.36,
        tempCoeffB: cfg('hydrogeneSynth').tempCoeffB ?? 0.004,
      }) * resolveBonus('production_hydrogene', null, tech, this.bonuses)),
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

  /** Coût d'un niveau de recherche. */
  costOfResearch(id: string, level: number): Resources {
    const def = this.research.get(id);
    if (!def) throw new Error(`Recherche inconnue : ${id}`);
    return researchCost(def.costDef, level);
  }

  /** Lance la recherche du prochain niveau (attend les ressources si besoin via advance). */
  startResearch(state: SimState, researchId: string): void {
    const def = this.research.get(researchId);
    if (!def) throw new Error(`Recherche inconnue : ${researchId}`);
    const target = (state.techLevels.get(researchId) ?? 0) + 1;

    // Gate : prérequis bâtiments
    for (const prereq of def.prereqBuildings) {
      const actual = state.levels.get(prereq.buildingId) ?? 0;
      if (actual < prereq.level) {
        throw new Error(`Prérequis non rempli : ${prereq.buildingId} niv.${prereq.level} (actuel: ${actual})`);
      }
    }

    // Gate : prérequis recherches
    for (const prereq of def.prereqResearch) {
      const actual = state.techLevels.get(prereq.researchId) ?? 0;
      if (actual < prereq.level) {
        throw new Error(`Prérequis recherche non rempli : ${prereq.researchId} niv.${prereq.level} (actuel: ${actual})`);
      }
    }

    const cost = this.costOfResearch(researchId, target);
    const waitH = this.timeToAfford(state, cost);
    if (!isFinite(waitH)) throw new Error(`inatteignable: recherche ${researchId} niv.${target}`);
    if (waitH > 0) this.advance(state, waitH * 3600);

    state.resources.minerai -= cost.minerai;
    state.resources.silicium -= cost.silicium;
    state.resources.hydrogene -= cost.hydrogene;

    const labLevel = state.levels.get('researchLab') ?? 0;
    const bonusMultiplier = resolveBonus('research_time', null, { researchLab: labLevel }, this.bonuses);
    const dur = researchTime(def.costDef, target, bonusMultiplier, { timeDivisor: 1000 });
    state.research = { researchId, targetLevel: target, completesAt: state.timeSec + dur };
  }

  /** Coût fixe d'un vaisseau (= unitCost). */
  costOfShip(shipId: string): Resources {
    const def = this.ships.get(shipId);
    if (!def) throw new Error(`Vaisseau inconnu : ${shipId}`);
    return unitCost(def);
  }

  /** Lance la construction d'un vaisseau (attend les ressources si besoin via advance). */
  startShip(state: SimState, shipId: string): void {
    const def = this.ships.get(shipId);
    if (!def) throw new Error(`Vaisseau inconnu : ${shipId}`);

    // Gate : prérequis bâtiments (principalement shipyard)
    for (const prereq of def.prereqBuildings) {
      const actual = state.levels.get(prereq.buildingId) ?? 0;
      if (actual < prereq.level) {
        throw new Error(`Prérequis non rempli : ${prereq.buildingId} niv.${prereq.level} (actuel: ${actual})`);
      }
    }

    // Gate : prérequis recherches
    for (const prereq of def.prereqResearch) {
      const actual = state.techLevels.get(prereq.researchId) ?? 0;
      if (actual < prereq.level) {
        throw new Error(`Prérequis recherche non rempli : ${prereq.researchId} niv.${prereq.level} (actuel: ${actual})`);
      }
    }

    const cost = this.costOfShip(shipId);
    const waitH = this.timeToAfford(state, cost);
    if (!isFinite(waitH)) throw new Error(`inatteignable: vaisseau ${shipId}`);
    if (waitH > 0) this.advance(state, waitH * 3600);

    state.resources.minerai -= cost.minerai;
    state.resources.silicium -= cost.silicium;
    state.resources.hydrogene -= cost.hydrogene;

    // bonusMultiplier=1 for MVP (ship_build_time bonus is a future refinement)
    const dur = unitTime(def, 1);
    state.shipBuild = { shipId, completesAt: state.timeSec + dur };
  }

  /** Secondes jusqu'au prochain événement = plus petit délai non-nul parmi build, research et shipBuild (0 si rien). */
  nextEventIn(state: SimState): number {
    const buildRemaining = state.build ? state.build.completesAt - state.timeSec : null;
    const researchRemaining = state.research ? state.research.completesAt - state.timeSec : null;
    const shipBuildRemaining = state.shipBuild ? state.shipBuild.completesAt - state.timeSec : null;

    const candidates: number[] = [];
    if (buildRemaining !== null && buildRemaining > 0) candidates.push(buildRemaining);
    if (researchRemaining !== null && researchRemaining > 0) candidates.push(researchRemaining);
    if (shipBuildRemaining !== null && shipBuildRemaining > 0) candidates.push(shipBuildRemaining);

    return candidates.length > 0 ? Math.min(...candidates) : 0;
  }

  /** Avance le temps de `seconds` : accumule les ressources, finalise chaque file dont completesAt <= timeSec. */
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
    if (state.research && state.timeSec >= state.research.completesAt) {
      state.techLevels.set(state.research.researchId, state.research.targetLevel);
      state.research = null;
    }
    if (state.shipBuild && state.timeSec >= state.shipBuild.completesAt) {
      const { shipId } = state.shipBuild;
      state.ships.set(shipId, (state.ships.get(shipId) ?? 0) + 1);
      state.shipBuild = null;
    }
  }
}
