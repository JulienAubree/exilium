// packages/game-sim/src/optimal-policy.ts
//
// OptimalPolicy — greedy ROI-based strategy.
//
// At each decision step, scores every eligible building (prereqs met, not at max)
// by its production-growth ROI:
//   ROI = ΔTotalHourlyProduction / (timeToAfford + buildTimeInHours)
//
// Producers (solarPlant, mines, synth) are scored by actual ΔProduction.
// ΔProduction is measured purely by cloning the state, bumping the level,
// and calling engine.production() — never mutating the real state.
//
// Special cases:
// - Bootstrap (baseTotal = 0): build solarPlant first so the energy factor
//   becomes nonzero and all producer ROIs can be evaluated meaningfully.
//
// - Non-producers that are prerequisites of milestones (robotics → shipyard,
//   researchLab) receive a "virtual" ΔProduction = currentTotalProduction × 0.3,
//   which makes them competitive once the producers have been upgraded a few
//   levels and their own incremental ROI starts to decline. This ensures the
//   shipyard milestone remains reachable without micro-managing a threshold.
//   During bootstrap (baseTotal = 0), they receive a fixed small virtual value
//   so they participate in scoring once solarPlant is up.
//
// - Storage buildings are excluded from the scoring and only built as last resort.

import { buildingTime, researchTime } from '@exilium/game-engine';
import type { SimState } from './state.js';
import type { SimEngine } from './engine.js';
import type { BuildingDef, ResearchDef, ShipDef } from './config.js';
import type { Action, Policy } from './policy.js';

// Non-producers that unlock milestones — given a virtual production value
// so they compete with producers once producer ROI declines.
const MILESTONE_PREREQS = new Set(['robotics', 'researchLab', 'shipyard', 'arsenal']);

// Eco-relevant researches for OptimalPolicy fallback priority order.
const ECO_RESEARCH_ORDER = ['energyTech', 'semiconductors', 'temperateProduction'];

/** Returns true if all prerequisites for a ship are met by the given state. Pure. */
function shipPrereqsMet(state: SimState, def: ShipDef): boolean {
  for (const prereq of def.prereqBuildings) {
    if ((state.levels.get(prereq.buildingId) ?? 0) < prereq.level) return false;
  }
  for (const prereq of def.prereqResearch) {
    if ((state.techLevels.get(prereq.researchId) ?? 0) < prereq.level) return false;
  }
  return true;
}

/** Returns true if all prerequisites for a research are met by the given state. Pure. */
function researchPrereqsMet(state: SimState, def: ResearchDef): boolean {
  for (const prereq of def.prereqBuildings) {
    if ((state.levels.get(prereq.buildingId) ?? 0) < prereq.level) return false;
  }
  for (const prereq of def.prereqResearch) {
    if ((state.techLevels.get(prereq.researchId) ?? 0) < prereq.level) return false;
  }
  return true;
}

// Pure storage — no production gain; skip from ROI scoring.
const STORAGE = new Set(['storageMinerai', 'storageSilicium', 'storageHydrogene']);

// Virtual production multiplier for milestone prerequisite buildings (vs current total prod).
// 0.3 means "worth 30% of current total production" — enough to compete once
// producers are at level 3+ and their incremental ROI has dropped.
const MILESTONE_VIRTUAL_PROD_FACTOR = 0.3;

// Fixed virtual production for milestone prereqs when base production is zero
// (before solarPlant is built). This is a small value that only wins over
// producers when no real production gain is possible.
const MILESTONE_VIRTUAL_PROD_FLOOR = 0.01;

export class OptimalPolicy implements Policy {
  name = 'optimal';

  decide(state: SimState, engine: SimEngine, buildings: Map<string, BuildingDef>): Action {
    // --- Collect eligible buildings (prereqs met, not at max) ---
    const eligible: string[] = [];
    for (const [id, def] of buildings) {
      const lvl = state.levels.get(id) ?? 0;
      if (def.maxLevel !== null && lvl >= def.maxLevel) continue;
      const prereqOk = def.prerequisites.every(
        (p) => (state.levels.get(p.buildingId) ?? 0) >= p.level,
      );
      if (!prereqOk) continue;
      eligible.push(id);
    }

    if (eligible.length === 0) return { type: 'stop' };

    // --- Bootstrap: if solarPlant is eligible and production is zero, build it first ---
    // Without solar energy, no producer can generate resources — the ROI algorithm
    // cannot evaluate gains meaningfully. solarPlant is always the first step.
    const baseProd = engine.production(state);
    const baseTotal = baseProd.minerai + baseProd.silicium + baseProd.hydrogene;

    if (baseTotal === 0 && eligible.includes('solarPlant')) {
      const cost = engine.costOf('solarPlant', (state.levels.get('solarPlant') ?? 0) + 1);
      const waitH = engine.timeToAfford(state, cost);
      if (isFinite(waitH)) {
        return { type: 'build', buildingId: 'solarPlant' };
      }
    }

    // --- Score all candidates by ROI = ΔProduction / investH ---
    let bestId: string | null = null;
    let bestRoi = -Infinity;
    const storageBackup: string[] = [];

    for (const id of eligible) {
      // Storage: skip from main scoring, keep as last-resort backup
      if (STORAGE.has(id)) {
        storageBackup.push(id);
        continue;
      }

      const lvl = state.levels.get(id) ?? 0;
      const nextLvl = lvl + 1;
      const def = buildings.get(id)!;

      const cost = engine.costOf(id, nextLvl);
      const waitH = engine.timeToAfford(state, cost);
      if (!isFinite(waitH)) continue;

      const buildH = buildingTime(def.costDef, nextLvl, 1) / 3600;
      const investH = Math.max(waitH + buildH, 1e-6);

      let deltaProd: number;

      if (MILESTONE_PREREQS.has(id)) {
        // Virtual production value: proportional to current output (or floor if zero).
        // This makes milestone-prereq buildings compete once producers plateau.
        deltaProd = baseTotal > 0
          ? baseTotal * MILESTONE_VIRTUAL_PROD_FACTOR
          : MILESTONE_VIRTUAL_PROD_FLOOR;
      } else {
        // Real ΔProduction: clone state, bump level, compare engine.production()
        // — never mutates the real state.
        const clone: SimState = {
          ...state,
          resources: { ...state.resources },
          levels: new Map(state.levels),
        };
        clone.levels.set(id, nextLvl);
        const newProd = engine.production(clone);
        const newTotal = newProd.minerai + newProd.silicium + newProd.hydrogene;
        deltaProd = newTotal - baseTotal;
        if (deltaProd <= 0) continue; // skip producers with no marginal gain
      }

      const roi = deltaProd / investH;

      if (roi > bestRoi) {
        bestRoi = roi;
        bestId = id;
      }
    }

    if (bestId !== null) {
      return { type: 'build', buildingId: bestId };
    }

    // --- Last resort: storage if nothing else is affordable ---
    for (const id of storageBackup) {
      const lvl = state.levels.get(id) ?? 0;
      const cost = engine.costOf(id, lvl + 1);
      const waitH = engine.timeToAfford(state, cost);
      if (!isFinite(waitH)) continue;
      return { type: 'build', buildingId: id };
    }

    return { type: 'stop' };
  }

  decideResearch(
    state: SimState,
    engine: SimEngine,
    research: Map<string, ResearchDef>,
  ): { type: 'research'; researchId: string } | null {
    // Need researchLab at level ≥ 1
    if ((state.levels.get('researchLab') ?? 0) < 1) return null;

    const baseProd = engine.production(state);
    const baseTotal = baseProd.minerai + baseProd.silicium + baseProd.hydrogene;

    let bestId: string | null = null;
    let bestRoi = 1e-9; // minimum epsilon: only pick if ROI > 0

    for (const id of ECO_RESEARCH_ORDER) {
      const def = research.get(id);
      if (!def) continue;
      const currentLevel = state.techLevels.get(id) ?? 0;
      if (def.maxLevel !== null && currentLevel >= def.maxLevel) continue;
      if (!researchPrereqsMet(state, def)) continue;

      const targetLevel = currentLevel + 1;

      // Check if we can afford the research
      const cost = engine.costOfResearch(id, targetLevel);
      const waitH = engine.timeToAfford(state, cost);
      if (!isFinite(waitH)) continue;

      // Estimate research time (seconds), converted to hours.
      // We pass bonusMultiplier=1.0 (conservative; actual lab bonus makes it faster).
      const researchSec = researchTime(def.costDef, targetLevel, 1.0, { timeDivisor: 1000 });
      const researchH = researchSec / 3600;

      const investH = Math.max(waitH + researchH, 1e-6);

      // Compute ΔProduction by cloning state and bumping techLevel
      const clone: SimState = {
        ...state,
        resources: { ...state.resources },
        levels: new Map(state.levels),
        techLevels: new Map(state.techLevels),
      };
      clone.techLevels.set(id, targetLevel);
      const newProd = engine.production(clone);
      const newTotal = newProd.minerai + newProd.silicium + newProd.hydrogene;
      const deltaProd = newTotal - baseTotal;

      // If research gives no production gain (e.g. semiconductors only saves energy consumption),
      // fall back to a small virtual gain to keep it in competition
      const effectiveDelta = deltaProd > 0 ? deltaProd : (baseTotal > 0 ? baseTotal * 0.02 : 0.001);

      const roi = effectiveDelta / investH;

      if (roi > bestRoi) {
        bestRoi = roi;
        bestId = id;
      }
    }

    // Fallback to priority order if ROI scoring found nothing
    if (bestId === null) {
      for (const id of ECO_RESEARCH_ORDER) {
        const def = research.get(id);
        if (!def) continue;
        const currentLevel = state.techLevels.get(id) ?? 0;
        if (def.maxLevel !== null && currentLevel >= def.maxLevel) continue;
        if (!researchPrereqsMet(state, def)) continue;
        const cost = engine.costOfResearch(id, currentLevel + 1);
        const waitH = engine.timeToAfford(state, cost);
        if (!isFinite(waitH)) continue;
        bestId = id;
        break;
      }
    }

    return bestId !== null ? { type: 'research', researchId: bestId } : null;
  }

  decideShip(
    state: SimState,
    _engine: SimEngine,
    ships: Map<string, ShipDef>,
  ): { type: 'buildShip'; shipId: string } | null {
    // MVP: build the first ship only if no ship has been produced yet
    const anyShipProduced = [...state.ships.values()].some((v) => v >= 1);
    if (anyShipProduced) return null;
    // Need shipyard at level ≥ 2 (prospector prereq)
    if ((state.levels.get('shipyard') ?? 0) < 2) return null;
    // Prefer prospector; fall back to any eligible ship with prereqs met
    const prospector = ships.get('prospector');
    if (prospector && shipPrereqsMet(state, prospector)) {
      return { type: 'buildShip', shipId: 'prospector' };
    }
    // Fallback: find any eligible ship
    for (const [id, def] of ships) {
      if (shipPrereqsMet(state, def)) {
        return { type: 'buildShip', shipId: id };
      }
    }
    return null;
  }
}
