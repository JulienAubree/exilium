// packages/game-sim/src/run.test.ts
import { describe, it, expect } from 'vitest';
import { runEco, runAll, MILESTONES } from './run.js';

describe('runEco (intégration)', () => {
  it('atteint les jalons bâtiment firstShipyard et firstResearchLab', () => {
    const r = runEco();
    const ids = r.milestones.map((m) => m.id);
    expect(ids).toContain('firstShipyard');
    expect(ids).toContain('firstResearchLab');
  });
});

describe('research milestones (Task 4)', () => {
  it('un run optimal atteint le jalon firstResearch', () => {
    const results = runAll();
    const optimal = results.find((r) => r.policy === 'optimal')!;
    const ids = optimal.milestones.map((m) => m.id);
    expect(ids).toContain('firstResearch');
  });

  it('energyTech est recherché quand le labo est dispo (optimal)', () => {
    const results = runAll();
    const optimal = results.find((r) => r.policy === 'optimal')!;
    const ids = optimal.milestones.map((m) => m.id);
    expect(ids).toContain('energyTech');
  });

  it('firstResearch a un temps fini (secondes simulées > 0)', () => {
    const results = runAll();
    const optimal = results.find((r) => r.policy === 'optimal')!;
    const m = optimal.milestones.find((m) => m.id === 'firstResearch');
    expect(m).toBeDefined();
    expect(m!.timeSec).toBeGreaterThan(0);
    expect(isFinite(m!.timeSec)).toBe(true);
  });
});

describe('firstShip milestone (Task 3)', () => {
  it('le jalon firstShip est défini dans MILESTONES', () => {
    expect(MILESTONES.find((m) => m.id === 'firstShip')).toBeDefined();
  });

  it('un run optimal atteint le jalon firstShip avec un temps fini', () => {
    const results = runAll();
    const optimal = results.find((r) => r.policy === 'optimal')!;
    const m = optimal.milestones.find((m) => m.id === 'firstShip');
    expect(m).toBeDefined();
    expect(m!.timeSec).toBeGreaterThan(0);
    expect(isFinite(m!.timeSec)).toBe(true);
  });
});
