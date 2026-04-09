export interface BiomeEffect {
  stat: string;
  category?: string;
  modifier: number; // e.g. 0.08 for +8%, -0.10 for -10%
}

export interface BiomeDefinition {
  id: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  compatiblePlanetTypes: string[]; // empty = all types
  effects: BiomeEffect[];
}

const BIOME_COUNT_WEIGHTS: [number, number][] = [
  [1, 0.15],
  [2, 0.30],
  [3, 0.30],
  [4, 0.20],
  [5, 0.05],
];

const RARITY_WEIGHTS: Record<string, number> = {
  common: 0.40,
  uncommon: 0.30,
  rare: 0.18,
  epic: 0.09,
  legendary: 0.03,
};

/**
 * Simple seeded PRNG (mulberry32).
 * Returns a function that produces deterministic values in [0, 1).
 */
export function seededRandom(seed: number): () => number {
  let t = seed | 0;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a coordinate-based seed for deterministic biome generation.
 */
export function coordinateSeed(galaxy: number, system: number, position: number): number {
  return galaxy * 1_000_000 + system * 1_000 + position;
}

/**
 * Generate the number of minor biomes for a planet (1-5).
 */
export function generateBiomeCount(rng: () => number = Math.random): number {
  const roll = rng();
  let cumulative = 0;
  for (const [count, weight] of BIOME_COUNT_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) return count;
  }
  return 3; // fallback
}

/**
 * Pick N biomes from the catalogue, filtered by planet type compatibility.
 * No duplicates. Weighted by rarity.
 */
export function pickBiomes(
  catalogue: BiomeDefinition[],
  planetTypeId: string,
  count: number,
  rng: () => number = Math.random,
): BiomeDefinition[] {
  const compatible = catalogue.filter(
    (b) => b.compatiblePlanetTypes.length === 0 || b.compatiblePlanetTypes.includes(planetTypeId),
  );

  const picked: BiomeDefinition[] = [];
  const remaining = [...compatible];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, b) => sum + (RARITY_WEIGHTS[b.rarity] ?? 0), 0);
    if (totalWeight <= 0) break;

    const roll = rng() * totalWeight;
    let cumulative = 0;
    let pickedIndex = 0;

    for (let j = 0; j < remaining.length; j++) {
      cumulative += RARITY_WEIGHTS[remaining[j].rarity] ?? 0;
      if (roll < cumulative) {
        pickedIndex = j;
        break;
      }
    }

    picked.push(remaining[pickedIndex]);
    remaining.splice(pickedIndex, 1);
  }

  return picked;
}

/**
 * Aggregate biome effects into a Record<string, number> compatible
 * with the talentBonuses parameter of calculateProductionRates.
 * Values are summed per stat key.
 */
export function aggregateBiomeBonuses(effects: BiomeEffect[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const effect of effects) {
    result[effect.stat] = (result[effect.stat] ?? 0) + effect.modifier;
  }
  return result;
}
