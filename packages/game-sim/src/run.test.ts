// packages/game-sim/src/run.test.ts
import { describe, it, expect } from 'vitest';
import { runEco } from './run.js';

describe('runEco (intégration)', () => {
  it('atteint les jalons bâtiment firstShipyard et firstResearchLab', () => {
    const r = runEco();
    const ids = r.milestones.map((m) => m.id);
    expect(ids).toContain('firstShipyard');
    expect(ids).toContain('firstResearchLab');
  });
});
