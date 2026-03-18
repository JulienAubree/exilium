import { describe, it, expect } from 'vitest';
import {
  baseExtraction,
  totalExtracted,
  extractionDuration,
  prospectionDuration,
  miningDuration,
  poolSize,
  accumulationCap,
} from './pve.js';

describe('baseExtraction', () => {
  it('returns 2000 at center level 1', () => {
    expect(baseExtraction(1)).toBe(2000);
  });
  it('returns 2800 at center level 2', () => {
    expect(baseExtraction(2)).toBe(2800);
  });
  it('returns 3600 at center level 3', () => {
    expect(baseExtraction(3)).toBe(3600);
  });
  it('returns 9200 at center level 10', () => {
    expect(baseExtraction(10)).toBe(9200);
  });
});

describe('totalExtracted', () => {
  it('caps at 10 prospectors', () => {
    expect(totalExtracted(1, 15, 100000, 500000)).toBe(2000 * 10);
  });
  it('caps at cargo capacity', () => {
    expect(totalExtracted(1, 3, 5000, 100000)).toBe(5000);
  });
  it('caps at deposit remaining', () => {
    expect(totalExtracted(1, 3, 100000, 1000)).toBe(1000);
  });
  it('normal case: 3 prospectors at level 1', () => {
    expect(totalExtracted(1, 3, 100000, 100000)).toBe(6000);
  });
});

describe('extractionDuration', () => {
  it('returns 15 min at level 1', () => {
    expect(extractionDuration(1)).toBe(15);
  });
  it('returns 5 min at level 11 (floor)', () => {
    expect(extractionDuration(11)).toBe(5);
  });
  it('returns 5 min at level 15 (floor)', () => {
    expect(extractionDuration(15)).toBe(5);
  });
  it('returns 10 min at level 6', () => {
    expect(extractionDuration(6)).toBe(10);
  });
});

describe('prospectionDuration', () => {
  it('returns 9 min for 20000 deposit', () => {
    expect(prospectionDuration(20000)).toBe(9);
  });
  it('returns 13 min for 40000 deposit', () => {
    expect(prospectionDuration(40000)).toBe(13);
  });
  it('returns 17 min for 60000 deposit', () => {
    expect(prospectionDuration(60000)).toBe(17);
  });
  it('returns 21 min for 80000 deposit', () => {
    expect(prospectionDuration(80000)).toBe(21);
  });
  it('returns 5 min for small deposit (< 10000)', () => {
    expect(prospectionDuration(5000)).toBe(5);
  });
});

describe('miningDuration', () => {
  it('returns 15 min at center 1, fracturing 0', () => {
    expect(miningDuration(1, 0)).toBe(15);
  });
  it('returns 10.5 min at center 1, fracturing 3', () => {
    expect(miningDuration(1, 3)).toBe(10.5);
  });
  it('returns 7.5 min at center 1, fracturing 5', () => {
    expect(miningDuration(1, 5)).toBe(7.5);
  });
  it('returns 3 min at center 1, fracturing 8', () => {
    expect(miningDuration(1, 8)).toBeCloseTo(3);
  });
  it('returns 5 min at center 11, fracturing 0 (floor)', () => {
    expect(miningDuration(11, 0)).toBe(5);
  });
  it('returns 1 min at center 11, fracturing 8 (floor * min multiplier)', () => {
    expect(miningDuration(11, 8)).toBeCloseTo(1);
  });
  it('floors multiplier at 0.2 (fracturing 10 same as 8)', () => {
    expect(miningDuration(1, 10)).toBe(miningDuration(1, 8));
  });
});

describe('poolSize', () => {
  it('returns 3 at level 1-2', () => {
    expect(poolSize(1)).toBe(3);
    expect(poolSize(2)).toBe(3);
  });
  it('returns 4 at level 3-4', () => {
    expect(poolSize(3)).toBe(4);
    expect(poolSize(4)).toBe(4);
  });
  it('returns 5 at level 5-6', () => {
    expect(poolSize(5)).toBe(5);
    expect(poolSize(6)).toBe(5);
  });
  it('returns 6 (cap) at level 7+', () => {
    expect(poolSize(7)).toBe(6);
    expect(poolSize(10)).toBe(6);
  });
});

describe('accumulationCap', () => {
  it('is 2x pool size', () => {
    expect(accumulationCap(1)).toBe(6);
    expect(accumulationCap(3)).toBe(8);
    expect(accumulationCap(7)).toBe(12);
  });
});
