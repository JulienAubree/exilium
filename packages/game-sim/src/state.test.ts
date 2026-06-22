import { describe, it, expect } from 'vitest';
import { initState } from './state.js';

describe('initState', () => {
  it('démarre un empire neuf à t=0', () => {
    const s = initState();
    expect(s.timeSec).toBe(0);
    expect(s.build).toBeNull();
    expect(s.levels.get('mineraiMine') ?? 0).toBe(0);
    expect(s.resources).toEqual({ minerai: 500, silicium: 500, hydrogene: 0 });
  });
});
