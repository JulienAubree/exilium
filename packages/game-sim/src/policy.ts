// packages/game-sim/src/policy.ts
import type { SimState } from './state.js';
import type { SimEngine } from './engine.js';
import type { BuildingDef } from './config.js';

export type Action = { type: 'build'; buildingId: string } | { type: 'stop' };
export interface Policy {
  name: string;
  decide(state: SimState, engine: SimEngine, buildings: Map<string, BuildingDef>): Action;
}

// Ordre de priorité éco MVP (producteurs d'abord, puis énergie, puis stockage).
const ECO_ORDER = ['mineraiMine', 'siliciumMine', 'solarPlant', 'hydrogeneSynth', 'storageMinerai'];

export class EcoPolicy implements Policy {
  name = 'eco';
  decide(state: SimState, _engine: SimEngine, buildings: Map<string, BuildingDef>): Action {
    for (const id of ECO_ORDER) {
      const def = buildings.get(id);
      if (!def) continue;
      const lvl = state.levels.get(id) ?? 0;
      if (lvl >= def.maxLevel) continue;
      const prereqOk = def.prerequisites.every((p) => (state.levels.get(p.buildingId) ?? 0) >= p.level);
      if (!prereqOk) continue;
      return { type: 'build', buildingId: id };
    }
    return { type: 'stop' };
  }
}
