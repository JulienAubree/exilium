/**
 * Spécialisation des mondes (vocations) — formules pures.
 * Chaque vocation = un bonus fort contre un malus réel (arbitrage).
 * Spec : docs/plans/2026-06-10-specialisation-mondes-v1.md
 */

export const VOCATION_IDS = ['miniere', 'industrielle'] as const;
export type VocationId = (typeof VOCATION_IDS)[number];

export interface VocationEffects {
  /** Delta additif appliqué aux trois productions (ex. +0.20 / −0.10). */
  productionDelta: number;
  /** Multiplicateur du temps de construction (ex. 1.15 / 0.80). */
  constructionTimeMult: number;
}

const NEUTRAL: VocationEffects = { productionDelta: 0, constructionTimeMult: 1 };

export function vocationEffects(
  vocation: string | null | undefined,
  universe: Record<string, unknown>,
): VocationEffects {
  switch (vocation) {
    case 'miniere':
      return {
        productionDelta: Number(universe.vocation_miniere_production_bonus) || 0.20,
        constructionTimeMult: 1 + (Number(universe.vocation_miniere_construction_malus) || 0.15),
      };
    case 'industrielle':
      return {
        productionDelta: -(Number(universe.vocation_industrielle_production_malus) || 0.10),
        constructionTimeMult: 1 - (Number(universe.vocation_industrielle_construction_bonus) || 0.20),
      };
    default:
      return NEUTRAL;
  }
}

export function isVocationId(value: unknown): value is VocationId {
  return typeof value === 'string' && (VOCATION_IDS as readonly string[]).includes(value);
}
