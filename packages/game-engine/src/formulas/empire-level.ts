/**
 * Pure formulas for the Empire Level system (2026-06-09).
 * Le niveau d'empire remplace le bâtiment « Centre de Pouvoir Impérial » :
 * il porte tout ce qui est permanent/structurel (capacité de gouvernance,
 * niveau de missions). L'exilium reste la ressource opérationnelle.
 *
 * See spec : docs/plans/2026-06-09-empire-level.md
 */

export interface EmpireLevelConfig {
  /** Base de la courbe d'XP quadratique (default 100). */
  xpCurveBase: number;
  /** Niveau max (default 100). */
  maxLevel: number;
  /** Niveaux requis par +1 de capacité de gouvernance (default 2). */
  capacityLevelsPerColony: number;
  /** Niveaux requis par +1 de niveau de missions (default 5). */
  missionLevelsPerBonus: number;
}

export const DEFAULT_EMPIRE_LEVEL_CONFIG: EmpireLevelConfig = {
  xpCurveBase: 100,
  maxLevel: 100,
  capacityLevelsPerColony: 2,
  missionLevelsPerBonus: 5,
};

/** Construit la config depuis universe_config, avec fallbacks. */
export function buildEmpireLevelConfig(universe: Record<string, unknown>): EmpireLevelConfig {
  return {
    xpCurveBase: Number(universe.empire_xp_curve_base) || DEFAULT_EMPIRE_LEVEL_CONFIG.xpCurveBase,
    maxLevel: Number(universe.empire_level_max) || DEFAULT_EMPIRE_LEVEL_CONFIG.maxLevel,
    capacityLevelsPerColony:
      Number(universe.empire_capacity_levels_per_colony) || DEFAULT_EMPIRE_LEVEL_CONFIG.capacityLevelsPerColony,
    missionLevelsPerBonus:
      Number(universe.empire_mission_levels_per_bonus) || DEFAULT_EMPIRE_LEVEL_CONFIG.missionLevelsPerBonus,
  };
}

/**
 * XP cumulée requise pour ATTEINDRE le niveau L (depuis le niveau 1).
 * Formule quadratique : base × (L-1) × L / 2.
 *  - L1 = 0 (départ)
 *  - L2 = 100
 *  - L5 = 1000
 *  - L10 = 4500
 *  - L20 = 19000
 */
export function empireXpRequiredForLevel(level: number, config: EmpireLevelConfig): number {
  if (level <= 1) return 0;
  return Math.round(config.xpCurveBase * (level - 1) * level / 2);
}

/** Inverse : à partir d'une XP cumulée, retourne le niveau atteint (cappé). */
export function empireLevelFromXp(xp: number, config: EmpireLevelConfig): number {
  if (xp <= 0) return 1;
  for (let level = config.maxLevel; level >= 1; level--) {
    if (empireXpRequiredForLevel(level, config) <= xp) return level;
  }
  return 1;
}

/**
 * Capacité de gouvernance pour un niveau d'empire donné.
 * Niveau 1 → 1 colonie (équivalent ex-IPC 0), puis +1 tous les
 * `capacityLevelsPerColony` niveaux.
 * `governanceFloor` = plancher grandfathered des joueurs ayant possédé
 * un Centre de Pouvoir Impérial (1 + niveau IPC archivé).
 */
export function empireGovernanceCapacity(
  level: number,
  config: EmpireLevelConfig,
  governanceFloor = 0,
): number {
  const fromLevel = 1 + Math.floor(Math.max(0, level - 1) / config.capacityLevelsPerColony);
  return Math.max(fromLevel, governanceFloor);
}

/**
 * Niveau de missions pour un niveau d'empire donné.
 * Niveau 1 → `missionDefaultLevel` (continuité avec l'existant), puis +1
 * tous les `missionLevelsPerBonus` niveaux.
 */
export function empireMissionLevel(
  level: number,
  missionDefaultLevel: number,
  config: EmpireLevelConfig,
): number {
  return missionDefaultLevel + Math.floor(Math.max(0, level - 1) / config.missionLevelsPerBonus);
}
