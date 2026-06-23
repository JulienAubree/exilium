// packages/game-sim/src/policy.ts
import type { SimState } from './state.js';
import type { SimEngine } from './engine.js';
import type { BuildingDef, ResearchDef, ShipDef } from './config.js';

export type Action = { type: 'build'; buildingId: string } | { type: 'research'; researchId: string } | { type: 'buildShip'; shipId: string } | { type: 'stop' };
export interface Policy {
  name: string;
  decide(state: SimState, engine: SimEngine, buildings: Map<string, BuildingDef>): Action;
  /**
   * Returns a research action to start, or null if no research should be started now.
   * MUST be pure — must NOT mutate the passed state.
   */
  decideResearch(
    state: SimState,
    engine: SimEngine,
    research: Map<string, ResearchDef>,
  ): { type: 'research'; researchId: string } | null;
  /**
   * Returns a buildShip action to start, or null if no ship should be built now.
   * MVP: builds the first eligible ship (prefer prospector) when shipyard ≥ 2 and
   * no ship has been produced yet. MUST be pure — must NOT mutate the passed state.
   */
  decideShip(
    state: SimState,
    engine: SimEngine,
    ships: Map<string, ShipDef>,
  ): { type: 'buildShip'; shipId: string } | null;
}

// Ordre de priorité éco MVP : énergie d'abord (sine qua non de la production),
// puis minerai (ressource de base), puis silicium, puis hydrogène, puis stockage.
// Sans centrale solaire, le facteur énergie est 0 → les mines ne produisent rien.
// La stratégie équilibre les niveaux : chaque bâtiment est upgradé à tour de rôle
// (on monte le bâtiment dont le niveau est le plus bas parmi les éligibles),
// en respectant l'ordre de priorité comme bris d'égalité.
// Robotics est inclus avant chantier/arsenal (c'est leur prérequis).
const ECO_ORDER = [
  'solarPlant',
  'mineraiMine',
  'siliciumMine',
  'hydrogeneSynth',
  'storageMinerai',
  'storageSilicium',
  'storageHydrogene',
  'robotics',
  'researchLab',
  'shipyard',
  'arsenal',
];

// Eco-relevant researches in priority order (production/energy boosters only).
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

export class EcoPolicy implements Policy {
  name = 'eco';
  decide(state: SimState, _engine: SimEngine, buildings: Map<string, BuildingDef>): Action {
    // Collect all candidates (eligible, prerequisites met, not at max)
    const candidates: { id: string; lvl: number; priority: number }[] = [];
    for (let i = 0; i < ECO_ORDER.length; i++) {
      const id = ECO_ORDER[i];
      const def = buildings.get(id);
      if (!def) continue;
      const lvl = state.levels.get(id) ?? 0;
      if (lvl >= def.maxLevel) continue;
      const prereqOk = def.prerequisites.every((p) => (state.levels.get(p.buildingId) ?? 0) >= p.level);
      if (!prereqOk) continue;
      candidates.push({ id, lvl, priority: i });
    }
    if (!candidates.length) return { type: 'stop' };
    // Pick the candidate with the lowest level (ties broken by priority order)
    candidates.sort((a, b) => a.lvl - b.lvl || a.priority - b.priority);
    return { type: 'build', buildingId: candidates[0].id };
  }

  decideResearch(
    state: SimState,
    _engine: SimEngine,
    research: Map<string, ResearchDef>,
  ): { type: 'research'; researchId: string } | null {
    // Need researchLab at level ≥ 1 to do any research
    if ((state.levels.get('researchLab') ?? 0) < 1) return null;
    // Pick first eco-relevant research whose prereqs are met and not yet maxed
    for (const id of ECO_RESEARCH_ORDER) {
      const def = research.get(id);
      if (!def) continue;
      const currentLevel = state.techLevels.get(id) ?? 0;
      // Skip if maxed
      if (def.maxLevel !== null && currentLevel >= def.maxLevel) continue;
      // Skip if prereqs not met
      if (!researchPrereqsMet(state, def)) continue;
      return { type: 'research', researchId: id };
    }
    return null;
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
