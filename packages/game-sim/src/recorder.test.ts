import { describe, it, expect } from 'vitest';
import { Recorder } from './recorder.js';
import { initState } from './state.js';

describe('Recorder', () => {
  it('horodate un jalon quand il est atteint et compte les murs', () => {
    const rec = new Recorder([{ id: 'firstMine', reach: (s) => (s.levels.get('mineraiMine') ?? 0) >= 1 }]);
    const s = initState();
    rec.onAction(s, { type: 'build', buildingId: 'mineraiMine' }, 0);
    s.levels.set('mineraiMine', 1); s.timeSec = 45;
    rec.onAction(s, { type: 'build', buildingId: 'siliciumMine' }, 3); // attente 3h = mur
    const r = rec.result('eco');
    expect(r.milestones.find((m) => m.id === 'firstMine')?.timeSec).toBe(45);
    expect(r.walls).toHaveLength(1);
    expect(r.walls[0].waitH).toBe(3);
  });
});
