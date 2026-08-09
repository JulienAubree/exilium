import { resolveBonus } from './bonus.js';
import { vocationEffects } from './vocation.js';
import { calculateGovernancePenalty } from './governance.js';
import type { BonusDefinition } from './bonus.js';

/**
 * ============================================================================
 * L'ASSEMBLAGE DES BONUS — le cœur pur, partagé par tout ce qui produit
 * ============================================================================
 *
 * L'économie fuyait de ~19,4 % (528 423/h affichés contre 425 740 versés)
 * parce que quatre endroits assemblaient les bonus différemment : l'affichage,
 * l'accrual de l'API, le tick du worker, et le simulateur de rythme.
 *
 * Cette fonction est désormais le SEUL assemblage. Elle ne connaît ni base de
 * données ni chargement : on lui donne des faits, elle rend un contexte. Les
 * quatre appelants passent par elle, donc ils ne peuvent plus diverger sur
 * autre chose que les faits eux-mêmes — et ceux-là sont testés par ailleurs.
 *
 * Elle vit dans game-engine et non dans l'API parce que le simulateur
 * (packages/game-sim) doit l'utiliser aussi : le laisser recomposer sa propre
 * arithmétique, c'était lui permettre de valider une économie qui n'était pas
 * celle du jeu.
 */

/** Le minimum dont l'assemblage a besoin — pas le GameConfig complet de l'API. */
export interface BonusContextConfig {
  bonuses: BonusDefinition[];
  universe: Record<string, unknown>;
}

/** Une ligne du détail, pour que l'interface montre ce que le serveur applique. */
export interface BonusBreakdownEntry {
  source: 'talents' | 'biomes' | 'recherche' | 'gouvernance' | 'vocation' | 'type_planete' | 'politique';
  stat: string;
  modifier: number;
}

/**
 * Les faits bruts de l'assemblage — volontairement sans base ni config, pour
 * que tous les chargeurs soient interchangeables et que le cœur reste testable
 * sans Postgres.
 */
export interface BonusFacts {
  /** Contexte de talents déjà calculé ({} si absent). */
  talentCtx: Record<string, number>;
  /** Bonus de biomes ACTIFS déjà agrégés ({} si aucun). */
  biomeBonuses: Record<string, number>;
  /** Niveaux de recherche du joueur ({} si anonyme). */
  researchLevels: Record<string, number>;
  /** Malus de récolte de gouvernance, déjà résolu (0 si exempt ou sous capacité). */
  governanceHarvestMalus: number;
  /** Vocation de la planète. */
  vocation: string | null | undefined;
  /** Delta de production des politiques d'empire actives (0 si aucune). */
  policyProductionDelta: number;
}

/** Des faits neutres, à surcharger — évite d'énumérer six champs à chaque appel. */
export function emptyBonusFacts(): BonusFacts {
  return {
    talentCtx: {},
    biomeBonuses: {},
    researchLevels: {},
    governanceHarvestMalus: 0,
    vocation: null,
    policyProductionDelta: 0,
  };
}

const PRODUCTION_STATS = ['production_minerai', 'production_silicium', 'production_hydrogene'] as const;

/**
 * À faits identiques, sortie identique — c'est toute la garantie de
 * non-divergence.
 *
 * Cumul ADDITIF (`1 + Σ deltas`) : sémantique historique du serveur, retenue
 * comme canonique. Le simulateur, qui multipliait les facteurs entre eux, s'y
 * aligne — sans conséquence tant que la recherche est sa seule source, mais la
 * règle est désormais explicite.
 */
export function assembleBonusContext(
  facts: BonusFacts,
  config: BonusContextConfig,
): { ctx: Record<string, number>; breakdown: BonusBreakdownEntry[] } {
  const ctx: Record<string, number> = {};
  const breakdown: BonusBreakdownEntry[] = [];
  const add = (source: BonusBreakdownEntry['source'], stat: string, modifier: number) => {
    if (!modifier) return;
    ctx[stat] = (ctx[stat] ?? 0) + modifier;
    breakdown.push({ source, stat, modifier });
  };

  // 1. Talents (par joueur, éventuellement par planète)
  for (const [stat, mod] of Object.entries(facts.talentCtx)) add('talents', stat, mod);

  // 2. Biomes actifs
  for (const [stat, mod] of Object.entries(facts.biomeBonuses)) add('biomes', stat, mod);

  // 3. Recherche — production ET énergie.
  //
  // L'énergie était autrefois conditionnelle : incluse à l'affichage, absente
  // de l'accrual, et le tick n'appliquait que la consommation sans la
  // production. Elle est désormais inconditionnelle partout : c'est la
  // condition même du « affiché = versé ».
  {
    const levels = facts.researchLevels;
    for (const stat of PRODUCTION_STATS) {
      const mult = resolveBonus(stat, null, levels, config.bonuses);
      if (mult > 1) add('recherche', stat, mult - 1);
    }
    const energyMult = resolveBonus('energy_production', null, levels, config.bonuses);
    if (energyMult > 1) add('recherche', 'energy_production', energyMult - 1);
    const energyEfficiency = resolveBonus('energy_consumption', null, levels, config.bonuses);
    if (energyEfficiency < 1) add('recherche', 'energy_consumption', energyEfficiency - 1);
  }

  // 4. Gouvernance : malus de récolte (la planète-mère est exemptée en amont)
  if (facts.governanceHarvestMalus > 0) {
    for (const stat of PRODUCTION_STATS) add('gouvernance', stat, -facts.governanceHarvestMalus);
  }

  // 5. Spécialisation du monde (vocation)
  const vocDelta = vocationEffects(facts.vocation, config.universe).productionDelta;
  if (vocDelta !== 0) {
    for (const stat of PRODUCTION_STATS) add('vocation', stat, vocDelta);
  }

  // 6. Politiques d'empire (par joueur)
  if (facts.policyProductionDelta !== 0) {
    for (const stat of PRODUCTION_STATS) add('politique', stat, facts.policyProductionDelta);
  }

  return { ctx, breakdown };
}

/**
 * Résolution du malus de gouvernance, partagée par les chargeurs pour que
 * l'arithmétique soit littéralement la même ligne de code.
 */
export function resolveHarvestMalus(
  isHomeworld: boolean,
  colonyCount: number,
  capacity: number,
  config: BonusContextConfig,
): number {
  if (isHomeworld) return 0;
  const harvestPenalties = (config.universe.governance_penalty_harvest as number[]) ?? [0.15, 0.35, 0.6];
  const constructionPenalties = (config.universe.governance_penalty_construction as number[]) ?? [0.15, 0.35, 0.6];
  return calculateGovernancePenalty(colonyCount, capacity, harvestPenalties, constructionPenalties).harvestMalus;
}
