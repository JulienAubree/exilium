import { describe, it, expect } from 'vitest';
import { computeCargoLoad } from '../planet-abandon.service.js';

describe('computeCargoLoad', () => {
  it('loads minerai then silicium then hydrogene up to capacity', () => {
    const res = computeCargoLoad(
      { minerai: 500, silicium: 300, hydrogene: 200 },
      1000,
    );
    expect(res.loaded).toEqual({ minerai: 500, silicium: 300, hydrogene: 200 });
    expect(res.overflow).toEqual({ minerai: 0, silicium: 0, hydrogene: 0 });
  });

  it('fills minerai first, overflow goes to debris for minerai+silicium', () => {
    const res = computeCargoLoad(
      { minerai: 2000, silicium: 1000, hydrogene: 500 },
      1500,
    );
    expect(res.loaded).toEqual({ minerai: 1500, silicium: 0, hydrogene: 0 });
    expect(res.overflow).toEqual({ minerai: 500, silicium: 1000, hydrogene: 500 });
  });

  it('fills minerai fully then partial silicium', () => {
    const res = computeCargoLoad(
      { minerai: 400, silicium: 800, hydrogene: 300 },
      1000,
    );
    expect(res.loaded).toEqual({ minerai: 400, silicium: 600, hydrogene: 0 });
    expect(res.overflow).toEqual({ minerai: 0, silicium: 200, hydrogene: 300 });
  });

  it('returns zero everywhere if capacity is 0', () => {
    const res = computeCargoLoad({ minerai: 100, silicium: 100, hydrogene: 100 }, 0);
    expect(res.loaded).toEqual({ minerai: 0, silicium: 0, hydrogene: 0 });
    expect(res.overflow).toEqual({ minerai: 100, silicium: 100, hydrogene: 100 });
  });

  it('floors fractional capacities toward loaded (keeps loaded never > stock)', () => {
    const res = computeCargoLoad({ minerai: 10, silicium: 10, hydrogene: 10 }, 15);
    expect(res.loaded).toEqual({ minerai: 10, silicium: 5, hydrogene: 0 });
    expect(res.overflow).toEqual({ minerai: 0, silicium: 5, hydrogene: 10 });
  });
});
