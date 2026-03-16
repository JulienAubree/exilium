import { describe, it, expect } from 'vitest';
import { shipCost, shipTime, defenseCost, defenseTime } from './shipyard-cost.js';

const lightFighterDef = { cost: { metal: 3000, crystal: 1000, deuterium: 0 } };
const cruiserDef = { cost: { metal: 20000, crystal: 7000, deuterium: 2000 } };
const espionageProbeDef = { cost: { metal: 0, crystal: 1000, deuterium: 0 } };
const rocketLauncherDef = { cost: { metal: 2000, crystal: 0, deuterium: 0 } };
const gaussCannonDef = { cost: { metal: 20000, crystal: 15000, deuterium: 2000 } };

describe('shipCost', () => {
  it('light fighter costs 3000/1000/0', () => {
    expect(shipCost(lightFighterDef)).toEqual({ metal: 3000, crystal: 1000, deuterium: 0 });
  });

  it('cruiser costs 20000/7000/2000', () => {
    expect(shipCost(cruiserDef)).toEqual({ metal: 20000, crystal: 7000, deuterium: 2000 });
  });
});

describe('shipTime', () => {
  it('light fighter, shipyard 1 = 2880s', () => {
    expect(shipTime(lightFighterDef, 1)).toBe(2880);
  });

  it('light fighter, shipyard 5 = 960s', () => {
    expect(shipTime(lightFighterDef, 5)).toBe(960);
  });

  it('cruiser, shipyard 5 = 6480s', () => {
    expect(shipTime(cruiserDef, 5)).toBe(6480);
  });

  it('minimum time is 1 second', () => {
    expect(shipTime(espionageProbeDef, 1000)).toBeGreaterThanOrEqual(1);
  });
});

describe('defenseCost', () => {
  it('rocket launcher costs 2000/0/0', () => {
    expect(defenseCost(rocketLauncherDef)).toEqual({ metal: 2000, crystal: 0, deuterium: 0 });
  });

  it('gauss cannon costs 20000/15000/2000', () => {
    expect(defenseCost(gaussCannonDef)).toEqual({ metal: 20000, crystal: 15000, deuterium: 2000 });
  });
});

describe('defenseTime', () => {
  it('rocket launcher, shipyard 1 = 1440s', () => {
    expect(defenseTime(rocketLauncherDef, 1)).toBe(1440);
  });

  it('gauss cannon, shipyard 6 = 7200s', () => {
    expect(defenseTime(gaussCannonDef, 6)).toBe(7200);
  });
});
