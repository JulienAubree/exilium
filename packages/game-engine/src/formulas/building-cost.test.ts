import { describe, it, expect } from 'vitest';
import { buildingCost, buildingTime } from './building-cost.js';

const metalMineDef = { baseCost: { metal: 60, crystal: 15, deuterium: 0 }, costFactor: 1.5 };
const crystalMineDef = { baseCost: { metal: 48, crystal: 24, deuterium: 0 }, costFactor: 1.6 };
const roboticsDef = { baseCost: { metal: 400, crystal: 120, deuterium: 200 }, costFactor: 2 };
const deutSynthDef = { baseCost: { metal: 225, crystal: 75, deuterium: 0 }, costFactor: 1.5 };

describe('buildingCost', () => {
  it('metal mine level 1 costs 60/15/0', () => {
    const cost = buildingCost(metalMineDef, 1);
    expect(cost).toEqual({ metal: 60, crystal: 15, deuterium: 0 });
  });

  it('metal mine level 5 costs 60*1.5^4 / 15*1.5^4', () => {
    const cost = buildingCost(metalMineDef, 5);
    expect(cost).toEqual({ metal: 303, crystal: 75, deuterium: 0 });
  });

  it('metal mine level 10', () => {
    const cost = buildingCost(metalMineDef, 10);
    expect(cost).toEqual({ metal: 2306, crystal: 576, deuterium: 0 });
  });

  it('crystal mine level 1 costs 48/24/0', () => {
    const cost = buildingCost(crystalMineDef, 1);
    expect(cost).toEqual({ metal: 48, crystal: 24, deuterium: 0 });
  });

  it('crystal mine level 5', () => {
    const cost = buildingCost(crystalMineDef, 5);
    expect(cost).toEqual({ metal: 314, crystal: 157, deuterium: 0 });
  });

  it('robotics level 3 costs with factor 2', () => {
    const cost = buildingCost(roboticsDef, 3);
    expect(cost).toEqual({ metal: 1600, crystal: 480, deuterium: 800 });
  });

  it('deut synth level 1', () => {
    const cost = buildingCost(deutSynthDef, 1);
    expect(cost).toEqual({ metal: 225, crystal: 75, deuterium: 0 });
  });
});

describe('buildingTime', () => {
  it('metal mine level 1, robotics 0 = 108s', () => {
    const time = buildingTime(metalMineDef, 1, 0);
    expect(time).toBe(108);
  });

  it('metal mine level 1, robotics 5 = 18s', () => {
    const time = buildingTime(metalMineDef, 1, 5);
    expect(time).toBe(18);
  });

  it('metal mine level 10, robotics 0', () => {
    const time = buildingTime(metalMineDef, 10, 0);
    expect(time).toBe(4150);
  });

  it('robotics level 3, robotics 2', () => {
    const time = buildingTime(roboticsDef, 3, 2);
    expect(time).toBe(998);
  });

  it('minimum time is 1 second', () => {
    const time = buildingTime(metalMineDef, 1, 1000);
    expect(time).toBeGreaterThanOrEqual(1);
  });
});
