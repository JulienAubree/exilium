import { describe, it, expect } from 'vitest';
import { initState } from './state.js';

describe('initState', () => {
  it('démarre un empire neuf à t=0', () => {
    const s = initState();
    expect(s.timeSec).toBe(0);
    expect(s.build).toBeNull();
    expect(s.levels.get('mineraiMine') ?? 0).toBe(0);
    // Alignee sur le seed (startingMinerai / Silicium / Hydrogene). L ancienne
    // valeur 500/500/0 etait une approximation MVP : le simulateur demarrait
    // avec 200 silicium de trop et sans hydrogene.
    expect(s.resources).toEqual({ minerai: 500, silicium: 300, hydrogene: 100 });
  });
});
