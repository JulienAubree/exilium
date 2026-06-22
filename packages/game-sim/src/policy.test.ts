// packages/game-sim/src/policy.test.ts
import { describe, it, expect } from 'vitest';
import { EcoPolicy } from './policy.js';
import { SimEngine } from './engine.js';
import { loadBuildings, loadProductionConfig } from './config.js';
import { initState } from './state.js';

describe('EcoPolicy', () => {
  it('commence par un producteur (mine de minerai)', () => {
    const buildings = loadBuildings();
    const engine = new SimEngine(buildings, loadProductionConfig());
    const action = new EcoPolicy().decide(initState(), engine, buildings);
    expect(action).toEqual({ type: 'build', buildingId: 'mineraiMine' });
  });
});
