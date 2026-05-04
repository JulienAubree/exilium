import { describe, it, expect } from 'vitest';
import {
  xpRequiredForLevel,
  xpToLevel,
  levelMultiplier,
  xpFromCombat,
  xpFromRunDepth,
  DEFAULT_XP_CONFIG,
} from './flagship-xp.js';

describe('xpRequiredForLevel', () => {
  it('returns 0 for level 1 (starting)', () => {
    expect(xpRequiredForLevel(1)).toBe(0);
  });
  it('returns 0 for level <= 1 (defensive)', () => {
    expect(xpRequiredForLevel(0)).toBe(0);
    expect(xpRequiredForLevel(-5)).toBe(0);
  });
  it('returns 100 for level 2', () => {
    expect(xpRequiredForLevel(2)).toBe(100);
  });
  it('returns 1000 for level 5', () => {
    // 100 × 4 × 5 / 2 = 1000
    expect(xpRequiredForLevel(5)).toBe(1000);
  });
  it('returns 4500 for level 10', () => {
    // 100 × 9 × 10 / 2 = 4500
    expect(xpRequiredForLevel(10)).toBe(4500);
  });
  it('returns 19000 for level 20', () => {
    // 100 × 19 × 20 / 2 = 19000
    expect(xpRequiredForLevel(20)).toBe(19000);
  });
  it('returns 177000 for level 60 (cap)', () => {
    // 100 × 59 × 60 / 2 = 177000
    expect(xpRequiredForLevel(60)).toBe(177000);
  });
});

describe('xpToLevel', () => {
  it('returns 1 for 0 XP', () => {
    expect(xpToLevel(0, 60)).toBe(1);
  });
  it('returns 1 for 99 XP (just below L2)', () => {
    expect(xpToLevel(99, 60)).toBe(1);
  });
  it('returns 2 for exactly 100 XP', () => {
    expect(xpToLevel(100, 60)).toBe(2);
  });
  it('returns 10 for 4500 XP', () => {
    expect(xpToLevel(4500, 60)).toBe(10);
  });
  it('caps at maxLevel for very high XP', () => {
    expect(xpToLevel(999999, 60)).toBe(60);
  });
  it('respects custom maxLevel', () => {
    expect(xpToLevel(999999, 20)).toBe(20);
  });
});

describe('levelMultiplier', () => {
  it('returns 1.0 at level 0', () => {
    expect(levelMultiplier(0, 0.05)).toBe(1.0);
  });
  it('returns 1.05 at level 1 with 5% per level', () => {
    expect(levelMultiplier(1, 0.05)).toBeCloseTo(1.05);
  });
  it('returns 2.0 at level 20 with 5% per level', () => {
    expect(levelMultiplier(20, 0.05)).toBe(2.0);
  });
  it('returns 4.0 at level 60 cap', () => {
    expect(levelMultiplier(60, 0.05)).toBe(4.0);
  });
});

describe('xpFromCombat', () => {
  it('returns 100 for enemyFP 1000 with default factor (0.10)', () => {
    expect(xpFromCombat(1000, DEFAULT_XP_CONFIG)).toBe(100);
  });
  it('rounds correctly for non-integer factor', () => {
    expect(xpFromCombat(123, DEFAULT_XP_CONFIG)).toBe(12);
  });
  it('returns 0 for enemyFP 0', () => {
    expect(xpFromCombat(0, DEFAULT_XP_CONFIG)).toBe(0);
  });
});

describe('xpFromRunDepth', () => {
  it('returns 1000 for depth 10 with default bonus (100)', () => {
    expect(xpFromRunDepth(10, DEFAULT_XP_CONFIG)).toBe(1000);
  });
  it('returns 2000 for depth 20', () => {
    expect(xpFromRunDepth(20, DEFAULT_XP_CONFIG)).toBe(2000);
  });
  it('returns 0 for depth 0 (defensive)', () => {
    expect(xpFromRunDepth(0, DEFAULT_XP_CONFIG)).toBe(0);
  });
});
