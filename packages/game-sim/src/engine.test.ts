import { describe, it, expect } from 'vitest';
import { SimEngine } from './engine.js';
import { loadBuildings, loadProductionConfig } from './config.js';
import { initState } from './state.js';
import { mineraiProduction, calculateProductionFactor, solarPlantEnergy, mineraiMineEnergy } from '@exilium/game-engine';

const engine = () => new SimEngine(loadBuildings(), loadProductionConfig());

describe('SimEngine.production', () => {
  it('mine niv.1 + solaire niv.1 : prod minerai = formule du game-engine', () => {
    const s = initState();
    s.levels.set('mineraiMine', 1);
    s.levels.set('solarPlant', 1);
    // solarPlantEnergy(1) = floor(20 * 1 * 1.1^1) = 22
    // mineraiMineEnergy(1) = floor(10 * 1 * 1.1^1) = 11
    const solarProduced = solarPlantEnergy(1, { baseProduction: 20, exponentBase: 1.1 });
    const mineraiConsumed = mineraiMineEnergy(1, { baseConsumption: 10, exponentBase: 1.1 });
    const factor = calculateProductionFactor(solarProduced, mineraiConsumed);
    expect(engine().production(s).minerai).toBe(mineraiProduction(1, factor, { baseProduction: 30, exponentBase: 1.1 }));
  });
});

describe('SimEngine.advance + startBuild', () => {
  it('attend d\'avoir les ressources puis construit la mine, qui monte au niveau 1', () => {
    const e = engine();
    const s = initState();
    e.startBuild(s, 'mineraiMine');          // niveau 0 → 1
    expect(s.build?.buildingId).toBe('mineraiMine');
    e.advance(s, e.nextEventIn(s));            // saute à la fin de construction
    expect(s.levels.get('mineraiMine')).toBe(1);
    expect(s.build).toBeNull();
  });
});
