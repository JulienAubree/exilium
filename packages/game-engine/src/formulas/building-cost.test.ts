import { describe, it, expect } from 'vitest';
import { buildingCost, buildingTime } from './building-cost.js';

const mineraiMineDef = { baseCost: { minerai: 60, silicium: 15, hydrogene: 0 }, costFactor: 1.5, baseTime: 45 };
const siliciumMineDef = { baseCost: { minerai: 48, silicium: 24, hydrogene: 0 }, costFactor: 1.6, baseTime: 45 };
const roboticsDef = { baseCost: { minerai: 400, silicium: 120, hydrogene: 200 }, costFactor: 2, baseTime: 60 };
const hydrogeneSynthDef = { baseCost: { minerai: 225, silicium: 75, hydrogene: 0 }, costFactor: 1.5, baseTime: 45 };

describe('buildingCost', () => {
  it('minerai mine level 1 applies 0.35 phaseMultiplier', () => {
    const cost = buildingCost(mineraiMineDef, 1);
    // 60 * 0.35 = 21, 15 * 0.35 = 5.25 → 5
    expect(cost).toEqual({ minerai: 21, silicium: 5, hydrogene: 0 });
  });

  it('minerai mine level 5 applies 0.78 phaseMultiplier', () => {
    const cost = buildingCost(mineraiMineDef, 5);
    // 60 * 1.5^4 * 0.78 = 303.75 * 0.78 = 236
    expect(cost).toEqual({ minerai: 236, silicium: 59, hydrogene: 0 });
  });

  it('minerai mine level 10 has no phaseMultiplier (1.0)', () => {
    const cost = buildingCost(mineraiMineDef, 10);
    expect(cost).toEqual({ minerai: 2306, silicium: 576, hydrogene: 0 });
  });

  it('silicium mine level 1 applies 0.35 phaseMultiplier', () => {
    const cost = buildingCost(siliciumMineDef, 1);
    expect(cost).toEqual({ minerai: 16, silicium: 8, hydrogene: 0 });
  });

  it('silicium mine level 5 applies 0.78 phaseMultiplier', () => {
    const cost = buildingCost(siliciumMineDef, 5);
    expect(cost).toEqual({ minerai: 245, silicium: 122, hydrogene: 0 });
  });

  it('robotics level 3 applies 0.55 phaseMultiplier', () => {
    const cost = buildingCost(roboticsDef, 3);
    // 400 * 4 * 0.55 = 880
    expect(cost).toEqual({ minerai: 880, silicium: 264, hydrogene: 440 });
  });

  it('hydrogene synth level 1 applies 0.35 phaseMultiplier', () => {
    const cost = buildingCost(hydrogeneSynthDef, 1);
    expect(cost).toEqual({ minerai: 78, silicium: 26, hydrogene: 0 });
  });

  it('level 8+ costs are unchanged (multiplier = 1.0)', () => {
    const l8 = buildingCost(mineraiMineDef, 8);
    const l9 = buildingCost(mineraiMineDef, 9);
    // L8: 60 * 1.5^7 * 1.0 = 1025
    expect(l8.minerai).toBe(1025);
    // L9: 60 * 1.5^8 * 1.0 = 1537
    expect(l9.minerai).toBe(1537);
  });
});

describe('buildingTime', () => {
  it('minerai mine level 1, robotics 0 applies 0.35 phaseMultiplier', () => {
    const time = buildingTime(mineraiMineDef, 1, 0);
    // 45 * 0.35 = 15.75 → 15
    expect(time).toBe(15);
  });

  it('minerai mine level 1, robotics 5 applies 0.35 phaseMultiplier', () => {
    const time = buildingTime(mineraiMineDef, 1, 5);
    // 45 / 6 * 0.35 = 2.625 → 2
    expect(time).toBe(2);
  });

  it('minerai mine level 10, robotics 0 has no phaseMultiplier', () => {
    const time = buildingTime(mineraiMineDef, 10, 0);
    expect(time).toBe(1729);
  });

  it('robotics level 3, robotics 2 applies 0.55 phaseMultiplier', () => {
    const time = buildingTime(roboticsDef, 3, 2);
    // 60 * 4 / 3 * 0.55 = 44
    expect(time).toBe(44);
  });

  it('minimum time is 1 second', () => {
    const time = buildingTime(mineraiMineDef, 1, 1000);
    expect(time).toBe(1);
  });
});
