// packages/game-sim/src/optimal-policy.ts
import { buildingTime } from '@exilium/game-engine';
import type { SimState } from './state.js';
import type { SimEngine } from './engine.js';
import type { BuildingDef } from './config.js';
import type { Action, Policy } from './policy.js';

// Buildings that don't produce resources — their ΔProduction is zero.
// We only build them when no producer improves ROI above epsilon, so that
// milestone-required buildings (robotics → shipyard, researchLab) remain reachable.
const NON_PRODUCERS = new Set(['robotics', 'shipyard', 'researchLab', 'arsenal',
  'storageMinerai', 'storageSilicium', 'storageHydrogene']);

// Fallback order for non-producers: build prerequisites of milestones in priority order.
const MILESTONE_PREREQ_ORDER = ['robotics', 'researchLab', 'shipyard', 'arsenal'];

const ROI_EPSILON = 1e-9; // minimum useful ROI

export class OptimalPolicy implements Policy {
  name = 'optimal';

  decide(state: SimState, engine: SimEngine, buildings: Map<string, BuildingDef>): Action {
    // --- Collect eligible buildings (prereqs met, not at max) ---
    const eligible: string[] = [];
    for (const [id, def] of buildings) {
      const lvl = state.levels.get(id) ?? 0;
      if (lvl >= def.maxLevel) continue;
      const prereqOk = def.prerequisites.every(
        (p) => (state.levels.get(p.buildingId) ?? 0) >= p.level,
      );
      if (!prereqOk) continue;
      eligible.push(id);
    }

    if (eligible.length === 0) return { type: 'stop' };

    // --- Current production baseline ---
    const baseProd = engine.production(state);
    const baseTotal = baseProd.minerai + baseProd.silicium + baseProd.hydrogene;

    // --- Score producers by ROI = ΔProd / (waitH + buildTimeH) ---
    let bestId: string | null = null;
    let bestRoi = -Infinity;

    for (const id of eligible) {
      if (NON_PRODUCERS.has(id)) continue;

      const lvl = state.levels.get(id) ?? 0;
      const nextLvl = lvl + 1;

      // Measure ΔProduction purely — clone state, bump level, compare
      const clone: SimState = {
        ...state,
        resources: { ...state.resources },
        levels: new Map(state.levels),
      };
      clone.levels.set(id, nextLvl);

      const newProd = engine.production(clone);
      const newTotal = newProd.minerai + newProd.silicium + newProd.hydrogene;
      const deltaProd = newTotal - baseTotal;

      // Only worth considering producers that actually improve production
      if (deltaProd <= 0) continue;

      const cost = engine.costOf(id, nextLvl);
      const waitH = engine.timeToAfford(state, cost);
      if (!isFinite(waitH)) continue;

      const def = buildings.get(id)!;
      const buildH = buildingTime(def.costDef, nextLvl, 1) / 3600;
      const investH = waitH + buildH;
      const roi = investH > 0 ? deltaProd / investH : deltaProd / 1e-9;

      if (roi > bestRoi) {
        bestRoi = roi;
        bestId = id;
      }
    }

    // If a producer with meaningful ROI was found, build it
    if (bestId !== null && bestRoi > ROI_EPSILON) {
      return { type: 'build', buildingId: bestId };
    }

    // --- Fallback: build milestone prerequisites (robotics→shipyard, researchLab) ---
    // Pick from MILESTONE_PREREQ_ORDER so we always progress toward milestones
    for (const id of MILESTONE_PREREQ_ORDER) {
      if (!eligible.includes(id)) continue;
      const cost = engine.costOf(id, (state.levels.get(id) ?? 0) + 1);
      const waitH = engine.timeToAfford(state, cost);
      if (!isFinite(waitH)) continue;
      return { type: 'build', buildingId: id };
    }

    // --- Last resort: any remaining eligible building ---
    for (const id of eligible) {
      const cost = engine.costOf(id, (state.levels.get(id) ?? 0) + 1);
      const waitH = engine.timeToAfford(state, cost);
      if (!isFinite(waitH)) continue;
      return { type: 'build', buildingId: id };
    }

    return { type: 'stop' };
  }
}
