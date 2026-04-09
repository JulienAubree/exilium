import { describe, it, expect } from 'vitest';
import { generateBiomeCount, pickBiomes, aggregateBiomeBonuses, seededRandom, coordinateSeed } from './biomes.js';
import type { BiomeDefinition, BiomeEffect } from './biomes.js';

describe('generateBiomeCount', () => {
  it('returns a number between 1 and 5', () => {
    for (let i = 0; i < 100; i++) {
      const count = generateBiomeCount();
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(5);
    }
  });
});

describe('pickBiomes', () => {
  const BIOMES: BiomeDefinition[] = [
    { id: 'fertile_plains', rarity: 'common', compatiblePlanetTypes: [], effects: [{ stat: 'production_silicium', modifier: 0.08 }] },
    { id: 'surface_deposits', rarity: 'common', compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.08 }] },
    { id: 'lava_flows', rarity: 'common', compatiblePlanetTypes: ['volcanic'], effects: [{ stat: 'production_silicium', modifier: 0.10 }] },
    { id: 'active_core', rarity: 'rare', compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.12 }, { stat: 'production_silicium', modifier: 0.12 }, { stat: 'production_hydrogene', modifier: 0.12 }] },
    { id: 'gravitational_nexus', rarity: 'legendary', compatiblePlanetTypes: [], effects: [{ stat: 'building_time', modifier: -0.10 }] },
  ];

  it('returns the requested number of biomes', () => {
    const result = pickBiomes(BIOMES, 'volcanic', 3);
    expect(result).toHaveLength(3);
  });

  it('filters by compatible planet type', () => {
    const result = pickBiomes(BIOMES, 'arid', 5);
    expect(result.every(b => b.id !== 'lava_flows')).toBe(true);
  });

  it('includes type-specific biomes for matching type', () => {
    let found = false;
    for (let i = 0; i < 50; i++) {
      const result = pickBiomes(BIOMES, 'volcanic', 4);
      if (result.some(b => b.id === 'lava_flows')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('returns no duplicates', () => {
    for (let i = 0; i < 50; i++) {
      const result = pickBiomes(BIOMES, 'volcanic', 4);
      const ids = result.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('returns fewer biomes if catalogue is too small', () => {
    const small = BIOMES.slice(0, 2);
    const result = pickBiomes(small, 'volcanic', 5);
    expect(result).toHaveLength(2);
  });
});

describe('aggregateBiomeBonuses', () => {
  it('returns empty record for no biomes', () => {
    expect(aggregateBiomeBonuses([])).toEqual({});
  });

  it('sums bonuses for the same stat', () => {
    const effects: BiomeEffect[] = [
      { stat: 'production_minerai', modifier: 0.08 },
      { stat: 'production_minerai', modifier: 0.12 },
      { stat: 'production_silicium', modifier: 0.10 },
    ];
    const result = aggregateBiomeBonuses(effects);
    expect(result['production_minerai']).toBeCloseTo(0.20);
    expect(result['production_silicium']).toBeCloseTo(0.10);
  });

  it('handles negative modifiers', () => {
    const effects: BiomeEffect[] = [
      { stat: 'building_time', modifier: -0.10 },
    ];
    const result = aggregateBiomeBonuses(effects);
    expect(result['building_time']).toBeCloseTo(-0.10);
  });
});

describe('seededRandom', () => {
  it('produces deterministic output for same seed', () => {
    const rng1 = seededRandom(12345);
    const rng2 = seededRandom(12345);
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it('produces different output for different seeds', () => {
    const rng1 = seededRandom(12345);
    const rng2 = seededRandom(54321);
    expect(rng1()).not.toBe(rng2());
  });
});

describe('coordinateSeed', () => {
  it('produces unique seeds for different coordinates', () => {
    const s1 = coordinateSeed(1, 100, 5);
    const s2 = coordinateSeed(1, 100, 6);
    const s3 = coordinateSeed(1, 101, 5);
    expect(s1).not.toBe(s2);
    expect(s1).not.toBe(s3);
  });
});

describe('pickBiomes with seeded random', () => {
  it('produces deterministic results with same seed', () => {
    const BIOMES: BiomeDefinition[] = [
      { id: 'fertile_plains', rarity: 'common', compatiblePlanetTypes: [], effects: [{ stat: 'production_silicium', modifier: 0.08 }] },
      { id: 'surface_deposits', rarity: 'common', compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.08 }] },
      { id: 'active_core', rarity: 'rare', compatiblePlanetTypes: [], effects: [{ stat: 'production_minerai', modifier: 0.12 }] },
    ];
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(42);
    const result1 = pickBiomes(BIOMES, 'volcanic', 2, rng1);
    const result2 = pickBiomes(BIOMES, 'volcanic', 2, rng2);
    expect(result1.map(b => b.id)).toEqual(result2.map(b => b.id));
  });
});
