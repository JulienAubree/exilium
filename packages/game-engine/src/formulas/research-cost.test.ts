import { describe, it, expect } from 'vitest';
import { researchCost, researchTime } from './research-cost.js';

const espionageTechDef = { baseCost: { minerai: 200, silicium: 1000, hydrogene: 200 }, costFactor: 2 };
const weaponsDef = { baseCost: { minerai: 800, silicium: 200, hydrogene: 0 }, costFactor: 2 };
const computerTechDef = { baseCost: { minerai: 0, silicium: 400, hydrogene: 600 }, costFactor: 2 };

describe('researchCost', () => {
  it('espionage tech level 1 applies 0.35 phaseMultiplier', () => {
    const cost = researchCost(espionageTechDef, 1);
    // 200 * 0.35 = 70, 1000 * 0.35 = 350
    expect(cost).toEqual({ minerai: 70, silicium: 350, hydrogene: 70 });
  });

  it('espionage tech level 4 applies 0.65 phaseMultiplier', () => {
    const cost = researchCost(espionageTechDef, 4);
    // 200 * 8 * 0.65 = 1040
    expect(cost).toEqual({ minerai: 1040, silicium: 5200, hydrogene: 1040 });
  });

  it('weapons tech level 1 applies 0.35 phaseMultiplier', () => {
    const cost = researchCost(weaponsDef, 1);
    expect(cost).toEqual({ minerai: 280, silicium: 70, hydrogene: 0 });
  });

  it('computer tech level 3 applies 0.55 phaseMultiplier', () => {
    const cost = researchCost(computerTechDef, 3);
    // 400 * 4 * 0.55 = 880
    expect(cost).toEqual({ minerai: 0, silicium: 880, hydrogene: 1320 });
  });

  it('level 8+ costs are unchanged (multiplier = 1.0)', () => {
    const cost = researchCost(espionageTechDef, 8);
    // 200 * 2^7 * 1.0 = 25600
    expect(cost).toEqual({ minerai: 25600, silicium: 128000, hydrogene: 25600 });
  });
});

describe('researchTime', () => {
  it('espionage tech level 1, lab 3 applies 0.35 phaseMultiplier', () => {
    const time = researchTime(espionageTechDef, 1, 3);
    // cost: 70 + 350 = 420, time: (420 / 4000) * 3600 * 0.35 = 132.3 → 132
    expect(time).toBe(132);
  });

  it('weapons tech level 1, lab 4 applies 0.35 phaseMultiplier', () => {
    const time = researchTime(weaponsDef, 1, 4);
    expect(time).toBe(88);
  });

  it('espionage tech level 4, lab 3 applies 0.65 phaseMultiplier', () => {
    const time = researchTime(espionageTechDef, 4, 3);
    expect(time).toBe(3650);
  });

  it('minimum time is 1 second', () => {
    const time = researchTime(computerTechDef, 1, 1000);
    expect(time).toBeGreaterThanOrEqual(1);
  });
});
