import { describe, it, expect } from 'vitest';
import { calculateShieldCapacity, calculateShieldEnergy } from './shield.js';

describe('calculateShieldCapacity', () => {
  it('returns 50 at level 1', () => {
    expect(calculateShieldCapacity(1)).toBe(50);
  });

  it('returns 65 at level 2 (round(50 * 1.3))', () => {
    expect(calculateShieldCapacity(2)).toBe(65);
  });

  it('returns 85 at level 3', () => {
    expect(calculateShieldCapacity(3)).toBe(85);
  });

  it('returns 530 at level 10', () => {
    expect(calculateShieldCapacity(10)).toBe(530);
  });

  it('returns 0 at level 0', () => {
    expect(calculateShieldCapacity(0)).toBe(0);
  });
});

describe('calculateShieldEnergy', () => {
  it('returns 30 at level 1', () => {
    expect(calculateShieldEnergy(1)).toBe(30);
  });

  it('returns 45 at level 2 (floor(30 * 1.5))', () => {
    expect(calculateShieldEnergy(2)).toBe(45);
  });

  it('returns 68 at level 3', () => {
    expect(calculateShieldEnergy(3)).toBe(68);
  });

  it('returns 1154 at level 10', () => {
    expect(calculateShieldEnergy(10)).toBe(1154);
  });

  it('returns 0 at level 0', () => {
    expect(calculateShieldEnergy(0)).toBe(0);
  });
});
