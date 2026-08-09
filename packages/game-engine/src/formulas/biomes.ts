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
 * Graine déterministe d'une coordonnée, pour la génération procédurale.
 *
 * ⚠️ **`worldSeed` n'est pas décoratif.** Sans lui, la graine est un pur
 * produit de `galaxy:system:position` : deux univers aux mêmes dimensions
 * produisent *exactement* les mêmes types de planètes et les mêmes biomes, aux
 * mêmes endroits. Une « carte neuve » serait donc l'ancienne carte, coordonnée
 * par coordonnée — le contenu à découvrir serait déjà connu de ceux qui ont
 * joué la précédente.
 *
 * La valeur vient de `universe_config.world_seed`. `0` (ou clé absente)
 * conserve **exactement** l'ancien comportement, pour que l'univers en cours
 * ne se réécrive pas sous les pieds des joueurs le jour du déploiement : c'est
 * en posant la clé, au moment du wipe, qu'on change de monde.
 */
export function coordinateSeed(
  galaxy: number,
  system: number,
  position: number,
  worldSeed = 0,
): number {
  const base = galaxy * 1_000_000 + system * 1_000 + position;
  if (!worldSeed) return base;
  // Mélange multiplicatif : deux graines voisines doivent donner des univers
  // sans parenté, pas des univers décalés d'une case.
  return (Math.imul(base ^ worldSeed, 0x27d4eb2d) ^ (worldSeed >>> 5)) | 0;
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
