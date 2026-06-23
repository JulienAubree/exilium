// packages/game-sim/src/policy.test.ts
import { describe, it, expect } from 'vitest';
import { EcoPolicy } from './policy.js';
import { SimEngine } from './engine.js';
import { loadBuildings, loadProductionConfig, loadBonuses } from './config.js';
import { initState } from './state.js';

describe('EcoPolicy', () => {
  it('commence par une centrale solaire (énergie d\'abord — sine qua non de la production)', () => {
    const buildings = loadBuildings();
    const engine = new SimEngine(buildings, loadProductionConfig(), loadBonuses());
    const action = new EcoPolicy().decide(initState(), engine, buildings);
    expect(action).toEqual({ type: 'build', buildingId: 'solarPlant' });
  });
});
