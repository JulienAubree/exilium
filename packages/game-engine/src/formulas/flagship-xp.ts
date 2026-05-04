/**
 * Pure formulas for the Flagship XP system (2026-05-04).
 * All input/output are plain data — no DB, no I/O.
 *
 * See spec : docs/superpowers/specs/2026-05-04-flagship-xp-design.md
 */

export interface XpConfig {
  /** XP per enemy FP killed (default 0.10). */
  perKillFpFactor: number;
  /** XP bonus per depth atteinte en fin de run (default 100). */
  perDepthBonus: number;
  /** Multiplier % par level (default 0.05 = +5%/level). */
  levelMultiplierPct: number;
  /** Cap level (default 60). */
  maxLevel: number;
}

export const DEFAULT_XP_CONFIG: XpConfig = {
  perKillFpFactor: 0.10,
  perDepthBonus: 100,
  levelMultiplierPct: 0.05,
  maxLevel: 60,
};

/**
 * XP cumulative requise pour ATTEINDRE le level L (depuis L1).
 * Formule quadratic : 100 × (L-1) × L / 2.
 *  - L1 = 0 (starting)
 *  - L2 = 100
 *  - L5 = 1000
 *  - L10 = 4500
 *  - L20 = 19000
 *  - L60 = 177000
 */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * (level - 1) * level / 2);
}

/** Inverse : à partir d'un XP cumulé, retourne le level atteint (capped). */
export function xpToLevel(xp: number, maxLevel: number): number {
  if (xp <= 0) return 1;
  for (let L = maxLevel; L >= 1; L--) {
    if (xpRequiredForLevel(L) <= xp) return L;
  }
  return 1;
}

/** Multiplier appliqué aux stats combat à un level donné. */
export function levelMultiplier(level: number, pctPerLevel: number): number {
  return 1 + level * pctPerLevel;
}

/** XP gagnée à un combat win (basé sur le FP total des ennemis tués). */
export function xpFromCombat(enemyFP: number, config: XpConfig): number {
  return Math.round(enemyFP * config.perKillFpFactor);
}

/** XP bonus en fin de run (basé sur la profondeur atteinte). */
export function xpFromRunDepth(depth: number, config: XpConfig): number {
  return Math.round(depth * config.perDepthBonus);
}
