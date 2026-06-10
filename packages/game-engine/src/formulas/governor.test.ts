import { describe, it, expect } from 'vitest';
import { governorCandidates, type GovernorContext } from './governor.js';

const roles = {
  producerMinerai: 'mineMinerai',
  producerSilicium: 'mineSilicium',
  producerHydrogene: 'synthHydrogene',
  producerEnergy: 'solarPlant',
  storageMinerai: 'storageM',
  storageSilicium: 'storageS',
  storageHydrogene: 'storageH',
};

function ctx(overrides: Partial<GovernorContext> = {}): GovernorContext {
  return {
    levels: { mineMinerai: 5, mineSilicium: 3, synthHydrogene: 4 },
    energyBalance: 100,
    storageFill: { minerai: 0.5, silicium: 0.5, hydrogene: 0.5 },
    roles,
    ...overrides,
  };
}

describe('governorCandidates (extraction)', () => {
  it('mine la plus basse d\'abord, puis les autres', () => {
    expect(governorCandidates('extraction', ctx())).toEqual([
      'mineSilicium', 'synthHydrogene', 'mineMinerai',
    ]);
  });

  it('déficit d\'énergie → centrale en tête', () => {
    expect(governorCandidates('extraction', ctx({ energyBalance: -50 }))[0]).toBe('solarPlant');
  });

  it('stock saturé → entrepôt prioritaire (le plus plein d\'abord)', () => {
    const c = governorCandidates('extraction', ctx({ storageFill: { minerai: 0.99, silicium: 0.97, hydrogene: 0.2 } }));
    expect(c.slice(0, 2)).toEqual(['storageM', 'storageS']);
  });

  it('énergie avant stockage avant mines', () => {
    const c = governorCandidates('extraction', ctx({ energyBalance: -1, storageFill: { minerai: 0.99, silicium: 0.5, hydrogene: 0.5 } }));
    expect(c[0]).toBe('solarPlant');
    expect(c[1]).toBe('storageM');
  });
});
