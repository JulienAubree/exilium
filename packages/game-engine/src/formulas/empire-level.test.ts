import { describe, it, expect } from 'vitest';
import {
  DEFAULT_EMPIRE_LEVEL_CONFIG,
  buildEmpireLevelConfig,
  empireXpRequiredForLevel,
  empireLevelFromXp,
  empireGovernanceCapacity,
  empireMissionLevel,
} from './empire-level.js';

const config = DEFAULT_EMPIRE_LEVEL_CONFIG;

describe('empireXpRequiredForLevel', () => {
  it('niveau 1 = 0 XP (départ)', () => {
    expect(empireXpRequiredForLevel(1, config)).toBe(0);
    expect(empireXpRequiredForLevel(0, config)).toBe(0);
  });

  it('suit la courbe quadratique base × (L-1) × L / 2', () => {
    expect(empireXpRequiredForLevel(2, config)).toBe(100);
    expect(empireXpRequiredForLevel(5, config)).toBe(1000);
    expect(empireXpRequiredForLevel(10, config)).toBe(4500);
    expect(empireXpRequiredForLevel(20, config)).toBe(19000);
  });

  it('respecte une base custom', () => {
    expect(empireXpRequiredForLevel(2, { ...config, xpCurveBase: 50 })).toBe(50);
  });
});

describe('empireLevelFromXp', () => {
  it('0 XP → niveau 1', () => {
    expect(empireLevelFromXp(0, config)).toBe(1);
    expect(empireLevelFromXp(-5, config)).toBe(1);
  });

  it('inverse exact de la courbe (frontières)', () => {
    expect(empireLevelFromXp(99, config)).toBe(1);
    expect(empireLevelFromXp(100, config)).toBe(2);
    expect(empireLevelFromXp(999, config)).toBe(4);
    expect(empireLevelFromXp(1000, config)).toBe(5);
    expect(empireLevelFromXp(4500, config)).toBe(10);
  });

  it('cap au niveau max', () => {
    expect(empireLevelFromXp(10_000_000, { ...config, maxLevel: 30 })).toBe(30);
  });
});

describe('empireGovernanceCapacity', () => {
  it('niveau 1 → capacité 1 (équivalent ex-IPC 0)', () => {
    expect(empireGovernanceCapacity(1, config)).toBe(1);
  });

  it('+1 colonie tous les capacityLevelsPerColony niveaux', () => {
    expect(empireGovernanceCapacity(2, config)).toBe(1);
    expect(empireGovernanceCapacity(3, config)).toBe(2);
    expect(empireGovernanceCapacity(5, config)).toBe(3);
    expect(empireGovernanceCapacity(19, config)).toBe(10);
  });

  it('le plancher grandfathered prime tant que la formule est en dessous', () => {
    // ex-joueur IPC 9 : floor = 10
    expect(empireGovernanceCapacity(1, config, 10)).toBe(10);
    expect(empireGovernanceCapacity(19, config, 10)).toBe(10);
    expect(empireGovernanceCapacity(21, config, 10)).toBe(11);
  });
});

describe('empireMissionLevel', () => {
  it('niveau 1 → niveau de missions par défaut (continuité)', () => {
    expect(empireMissionLevel(1, 3, config)).toBe(3);
  });

  it('+1 tous les missionLevelsPerBonus niveaux', () => {
    expect(empireMissionLevel(5, 3, config)).toBe(3);
    expect(empireMissionLevel(6, 3, config)).toBe(4);
    expect(empireMissionLevel(11, 3, config)).toBe(5);
  });
});

describe('buildEmpireLevelConfig', () => {
  it('lit universe_config avec fallbacks', () => {
    expect(buildEmpireLevelConfig({})).toEqual(DEFAULT_EMPIRE_LEVEL_CONFIG);
    expect(buildEmpireLevelConfig({ empire_xp_curve_base: 200, empire_level_max: 50 })).toEqual({
      ...DEFAULT_EMPIRE_LEVEL_CONFIG,
      xpCurveBase: 200,
      maxLevel: 50,
    });
  });
});
