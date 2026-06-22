import { describe, it, expect } from 'vitest';
import { loadBuildings, loadProductionConfig } from './config.js';

describe('config', () => {
  it('mappe la mine de minerai vers un BuildingCostDef', () => {
    const b = loadBuildings().get('mineraiMine')!;
    expect(b.costDef).toEqual({ baseCost: { minerai: 60, silicium: 15, hydrogene: 0 }, costFactor: 1.5, baseTime: 45 });
    expect(b.maxLevel).toBe(25);
  });
  it('charge la prod config du solaire', () => {
    expect(loadProductionConfig().get('solarPlant')).toMatchObject({ baseProduction: 20, exponentBase: 1.1 });
  });
});
