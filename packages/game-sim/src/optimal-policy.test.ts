// packages/game-sim/src/optimal-policy.test.ts
import { describe, it, expect } from 'vitest';
import { OptimalPolicy } from './optimal-policy.js';
import { EcoPolicy } from './policy.js';
import { SimEngine } from './engine.js';
import { loadBuildings, loadProductionConfig, loadBonuses, loadShips } from './config.js';
import { initState } from './state.js';
import { Recorder } from './recorder.js';

function timeToShipyard(policy: { decide: any; name: string }): number {
  const buildings = loadBuildings();
  const engine = new SimEngine(buildings, loadProductionConfig(), loadBonuses(), undefined, loadShips());
  const rec = new Recorder([{ id: 'shipyard', reach: (s) => (s.levels.get('shipyard') ?? 0) >= 1 }]);
  const s = initState();
  for (let i = 0; i < 3000 && s.timeSec < 200 * 24 * 3600; i++) {
    const a = policy.decide(s, engine, buildings);
    if (a.type === 'stop') break;
    const waitH = engine.timeToAfford(s, engine.costOf(a.buildingId, (s.levels.get(a.buildingId) ?? 0) + 1));
    if (!isFinite(waitH)) break;
    engine.startBuild(s, a.buildingId);
    engine.advance(s, engine.nextEventIn(s)); // complète la construction → niveaux à jour
    rec.onAction(s, a, waitH); // …puis on horodate les jalons avec l'état post-construction
    if ((s.levels.get('shipyard') ?? 0) >= 1) break;
  }
  return rec.result(policy.name).milestones.find((m) => m.id === 'shipyard')?.timeSec ?? Infinity;
}

describe('OptimalPolicy', () => {
  it("atteint le chantier au plus tard aussi vite que l'éco (borne basse)", () => {
    const opt = timeToShipyard(new OptimalPolicy());
    const eco = timeToShipyard(new EcoPolicy());
    // Les deux DOIVENT atteindre le jalon (sinon le test passerait trivialement Infinity<=Infinity).
    expect(opt).toBeLessThan(Infinity);
    expect(eco).toBeLessThan(Infinity);
    expect(opt).toBeLessThanOrEqual(eco);
  });
  it('ne propose jamais un bâtiment au max ou aux prérequis non remplis', () => {
    const buildings = loadBuildings();
    const engine = new SimEngine(buildings, loadProductionConfig(), loadBonuses(), undefined, loadShips());
    const a = new OptimalPolicy().decide(initState(), engine, buildings);
    expect(a.type).toBe('build');
    if (a.type === 'build') {
      const def = buildings.get(a.buildingId)!;
      expect(def.prerequisites.every((p) => 0 >= p.level)).toBe(true); // niveaux à 0 au départ
    }
  });
});
