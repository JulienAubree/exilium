import { describe, it, expect } from 'vitest';
import { loadBuildings, loadProductionConfig, loadResearch, loadBonuses } from './config.js';

describe('config', () => {
  it('mappe la mine de minerai vers un BuildingCostDef', () => {
    const b = loadBuildings().get('mineraiMine')!;
    expect(b.costDef).toEqual({ baseCost: { minerai: 60, silicium: 15, hydrogene: 0 }, costFactor: 1.5, baseTime: 45 });
    expect(b.maxLevel).toBe(25);
  });
  it('charge la prod config du solaire', () => {
    expect(loadProductionConfig().get('solarPlant')).toMatchObject({ baseProduction: 20, exponentBase: 1.1 });
  });
  it('charge energyTech avec son coût et son prérequis labo', () => {
    const r = loadResearch().get('energyTech')!;
    expect(r.costDef).toEqual({ baseCost: { minerai: 0, silicium: 800, hydrogene: 400 }, costFactor: 2 });
    expect(r.prereqBuildings).toContainEqual({ buildingId: 'researchLab', level: 1 });
  });
  it('expose le bonus energyTech→energy_production', () => {
    expect(loadBonuses().some((b) => b.sourceId === 'energyTech' && b.stat === 'energy_production')).toBe(true);
  });
});
