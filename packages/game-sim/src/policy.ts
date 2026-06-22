// packages/game-sim/src/policy.ts
import type { SimState } from './state.js';
import type { SimEngine } from './engine.js';
import type { BuildingDef } from './config.js';

export type Action = { type: 'build'; buildingId: string } | { type: 'stop' };
export interface Policy {
  name: string;
  decide(state: SimState, engine: SimEngine, buildings: Map<string, BuildingDef>): Action;
}

// Ordre de priorité éco MVP : énergie d'abord (sine qua non de la production),
// puis minerai (ressource de base), puis silicium, puis hydrogène, puis stockage.
// Sans centrale solaire, le facteur énergie est 0 → les mines ne produisent rien.
// La stratégie équilibre les niveaux : chaque bâtiment est upgradé à tour de rôle
// (on monte le bâtiment dont le niveau est le plus bas parmi les éligibles),
// en respectant l'ordre de priorité comme bris d'égalité.
const ECO_ORDER = ['solarPlant', 'mineraiMine', 'siliciumMine', 'hydrogeneSynth', 'storageMinerai'];

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
}
