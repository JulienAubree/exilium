export interface BonusDefinition {
  sourceType: 'building' | 'research';
  sourceId: string;
  stat: string;
  percentPerLevel: number;
  category: string | null;
  /**
   * Soft-cap controls (Sprint 1 of the 5-pillar rebalance).
   *
   *   'linear'     → keep historical `1 + (percentPerLevel/100) × level`
   *   'asymptotic' → bonus(level) = softCapMax × (1 - exp(-softCapK × level))
   *                  so vétérans gain less per level at high tiers while
   *                  newcomers ramp normally.
   *
   * softCapMax is the asymptote of the *bonus portion* (e.g. 1.5 = +150%).
   * Final modifier = 1 + bonus(level). When softCapMax/K are missing on an
   * asymptotic entry, the bonus falls back to linear.
   */
  bonusType?: 'linear' | 'asymptotic';
  softCapMax?: number | null;
  softCapK?: number | null;
}

/**
 * Asymptotic bonus shape used by research with `bonusType='asymptotic'`.
 * Returns the bonus value (0 at lvl 0, approaches `max` as level → ∞).
 */
export function softCapBonus(level: number, max: number, k: number): number {
  if (level <= 0) return 0;
  if (max <= 0 || k <= 0) return 0;
  return max * (1 - Math.exp(-k * level));
}

/**
 * Resolves the combined multiplier for a given stat + optional category.
 *
 * Matching: bonus.stat === stat AND (bonus.category is null OR bonus.category === category).
 * Buildings: 1 / (1 + level) — diminishing returns (Exilium classic).
 * Research:
 *   - 'linear'     (default) : 1 + percentPerLevel / 100 × level
 *   - 'asymptotic'           : 1 + softCapBonus(level, softCapMax, softCapK)
 *     Sign of percentPerLevel decides whether the bonus is a gain (positive →
 *     1 + softCap) or a cost reduction (negative → 1 - softCap, clamped ≥ 0.01).
 * Combined: product of all matching modifiers, clamped to min 0.01.
 * Returns 1.0 if no bonus matches or all source levels are 0.
 */
export function resolveBonus(
  stat: string,
  category: string | null,
  userLevels: Record<string, number>,
  bonusDefs: BonusDefinition[],
): number {
  let result = 1;
  let hasMatch = false;

  for (const def of bonusDefs) {
    if (def.stat !== stat) continue;
    if (def.category !== null && def.category !== category) continue;

    const level = userLevels[def.sourceId] ?? 0;
    if (level === 0) continue;

    hasMatch = true;
    let modifier: number;
    if (def.sourceType === 'building') {
      modifier = 1 / (1 + level);
    } else if (def.bonusType === 'asymptotic' && def.softCapMax && def.softCapK) {
      const bonus = softCapBonus(level, def.softCapMax, def.softCapK);
      // Direction of the bonus is the sign of percentPerLevel : positive gain
      // (combat stats, speed) yields 1 + bonus, negative reduction (-cost,
      // -consumption) yields 1 - bonus, clamped to floor.
      modifier = def.percentPerLevel >= 0
        ? 1 + bonus
        : Math.max(0.01, 1 - bonus);
    } else {
      modifier = Math.max(0.01, 1 + (def.percentPerLevel / 100) * level);
    }
    result *= modifier;
  }

  if (!hasMatch) return 1;
  return Math.max(0.01, result);
}

/**
 * Compute the building bonus multiplier for a single level.
 * Used for UI display of bonus progression.
 */
export function buildingBonusAtLevel(level: number): number {
  if (level <= 0) return 1;
  return 1 / (1 + level);
}

/**
 * Passive research time multiplier from all annex lab levels combined.
 * Linear: each annex level gives -5% research time.
 * Unlike building bonuses in resolveBonus (diminishing returns),
 * this is intentionally linear to reward empire expansion.
 */
export function researchAnnexBonus(totalAnnexLevels: number, percentPerLevel: number = 5): number {
  if (totalAnnexLevels <= 0) return 1;
  return Math.max(0.01, 1 - totalAnnexLevels * (percentPerLevel / 100));
}

/**
 * Research time multiplier from total discovered biomes across all planets.
 * Each unique biome discovered gives -1% research time.
 */
export function researchBiomeBonus(totalDiscoveredBiomes: number, percentPerBiome: number = 1): number {
  if (totalDiscoveredBiomes <= 0) return 1;
  return Math.max(0.01, 1 - totalDiscoveredBiomes * (percentPerBiome / 100));
}
