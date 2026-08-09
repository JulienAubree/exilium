import { eq, and } from 'drizzle-orm';
import { byUser } from '../../lib/db-helpers.js';
import {
  planets,
  planetBiomes,
  empirePolicies,
  empireProgression,
  getUserResearchLevels,
  getAllUserResearchLevels,
} from '@exilium/db';
import type { Database } from '@exilium/db';
import {
  aggregateBiomeBonuses,
  assembleBonusContext,
  resolveHarvestMalus,
  emptyBonusFacts,
  policyEffects,
  neutralPolicyEffects,
  buildEmpireLevelConfig,
  empireGovernanceCapacity,
  type BiomeEffect,
  type BonusFacts,
  type BonusBreakdownEntry,
} from '@exilium/game-engine';
import { findPlanetTypeByRole } from '../../lib/config-helpers.js';
import type { GameConfig } from '../admin/game-config.service.js';

/**
 * ============================================================================
 * L'ASSEMBLEUR DE CONTEXTE DE BONUS — source de vérité unique
 * ============================================================================
 *
 * Avant ce module, quatre chemins calculaient la production d'une planète avec
 * des ingrédients différents :
 *
 *   A. affichage (getProductionRates) ....... tout, énergie comprise
 *   B. accrual API (materialize/spend) ...... tout SAUF la recherche énergie
 *   C. tick du worker (resource-tick) ....... ni biomes, ni politiques, ni
 *                                             talents, ni bouclier, et
 *                                             seulement la moitié de l'énergie
 *   D. game-sim ............................. sa propre arithmétique
 *
 * Le tick étant le créditeur dominant (il réécrit resources_updated_at de
 * toutes les planètes toutes les 15 min, donc il « consomme » l'essentiel du
 * temps mur), c'est SA version appauvrie qui était réellement versée aux
 * joueurs pendant que l'interface affichait celle de A : ~528 423/h affichés
 * contre ~425 740/h versés, soit une fuite de ~19,4 %.
 *
 * Ce module rend cette divergence structurellement impossible : le cœur
 * `assembleBonusContext` est PUR et ne connaît rien à la base. Deux
 * chargeurs l'alimentent avec exactement les mêmes faits :
 *
 *   - `createPerPlanetBonusLoader` — une planète, ~5 requêtes (API)
 *   - `createBatchBonusLoader`     — tout l'univers en 4 requêtes (tick)
 *
 * Un test unitaire verrouille l'égalité stricte des deux chargeurs, et un test
 * d'intégration verrouille « l'affiché égale le versé au centime ».
 *
 * ⚠️ Contrainte de perf du tick : O(requêtes constantes), jamais N+1. Le
 * chargeur batch existe précisément pour ça — ne jamais appeler le chargeur
 * par-planète dans une boucle sur les planètes.
 */

// Le cœur de l'assemblage vit dans `@exilium/game-engine` : le simulateur de
// rythme (packages/game-sim) doit l'utiliser aussi, et un paquet applicatif ne
// peut pas être importé depuis un paquet de formules. Ce module ne garde que
// ce qui touche la base : les deux chargeurs de faits.
export {
  assembleBonusContext,
  resolveHarvestMalus,
  emptyBonusFacts,
  type BonusFacts,
  type BonusBreakdownEntry,
};

/** Forme minimale d'une planète attendue par les chargeurs. */
export interface PlanetBonusInput {
  planetClassId?: string | null;
  vocation?: string | null;
}

interface TalentServiceLike {
  computeTalentContext(userId: string, planetId?: string): Promise<Record<string, number>>;
}

function aggregateActiveBiomes(biomeIds: string[], config: GameConfig): Record<string, number> {
  if (biomeIds.length === 0) return {};
  const effectsByBiome = new Map(config.biomes.map((b) => [b.id, b.effects as unknown as BiomeEffect[]]));
  const allEffects: BiomeEffect[] = biomeIds.flatMap((id) => effectsByBiome.get(id) ?? []);
  return aggregateBiomeBonuses(allEffects);
}

/**
 * Chargeur par planète — le chemin de l'API (materialize, spend, rates).
 * ~5 requêtes par appel : à ne jamais utiliser dans une boucle sur les planètes.
 */
export function createPerPlanetBonusLoader(
  db: Database,
  config: GameConfig,
  talentService?: TalentServiceLike,
) {
  const homeworldTypeId = findPlanetTypeByRole(config, 'homeworld').id;
  const levelConfig = buildEmpireLevelConfig(config.universe);

  return async function loadFacts(
    planetId: string,
    userId: string | undefined,
    planet: PlanetBonusInput,
  ): Promise<BonusFacts> {
    const talentCtx = talentService && userId ? await talentService.computeTalentContext(userId, planetId) : {};

    const biomeRows = await db
      .select({ biomeId: planetBiomes.biomeId })
      .from(planetBiomes)
      .where(and(eq(planetBiomes.planetId, planetId), eq(planetBiomes.active, true)));
    const biomeBonuses = aggregateActiveBiomes(biomeRows.map((r) => r.biomeId), config);

    if (!userId) {
      return {
        talentCtx,
        biomeBonuses,
        researchLevels: {},
        governanceHarvestMalus: 0,
        vocation: planet.vocation,
        policyProductionDelta: 0,
      };
    }

    const [researchLevels, userPlanets, progressionRow, policyRow] = await Promise.all([
      getUserResearchLevels(db, userId),
      db.select({ status: planets.status }).from(planets).where(byUser(planets.userId, userId)),
      db
        .select({ level: empireProgression.level })
        .from(empireProgression)
        .where(byUser(empireProgression.userId, userId))
        .limit(1),
      db
        .select({ active: empirePolicies.active })
        .from(empirePolicies)
        .where(byUser(empirePolicies.userId, userId))
        .limit(1),
    ]);

    const colonyCount = Math.max(0, userPlanets.filter((p) => p.status === 'active').length - 1);
    const capacity = empireGovernanceCapacity(progressionRow[0]?.level ?? 1, levelConfig);
    const effects = policyRow[0] ? policyEffects(policyRow[0].active as Record<string, string>) : neutralPolicyEffects();

    return {
      talentCtx,
      biomeBonuses,
      researchLevels,
      governanceHarvestMalus: resolveHarvestMalus(
        planet.planetClassId === homeworldTypeId,
        colonyCount,
        capacity,
        config,
      ),
      vocation: planet.vocation,
      policyProductionDelta: effects.productionDelta,
    };
  };
}

/**
 * Chargeur batch — le chemin du tick. Précharge tout l'univers en 4 requêtes,
 * puis répond en mémoire, planète par planète.
 *
 * Les talents sont fournis par l'appelant (`talentCtxFor`) : les calculer ici
 * exigerait une requête par planète, ce que le contrat de perf interdit. Le
 * tick passe aujourd'hui un contexte vide — computeTalentContext n'émet plus
 * aucune clé de production depuis le retrait des talents (2026-05-03) — mais
 * le point d'injection est réel, pas un bouchon : le jour où un vaisseau
 * spécial produira `production_*`, il se branche ici.
 */
export async function createBatchBonusLoader(
  db: Database,
  config: GameConfig,
  opts?: { talentCtxFor?: (userId: string, planetId: string) => Record<string, number> },
) {
  const homeworldTypeId = findPlanetTypeByRole(config, 'homeworld').id;
  const levelConfig = buildEmpireLevelConfig(config.universe);

  const [biomeRows, researchByUser, progressionRows, policyRows, planetRows] = await Promise.all([
    db
      .select({ planetId: planetBiomes.planetId, biomeId: planetBiomes.biomeId })
      .from(planetBiomes)
      .where(eq(planetBiomes.active, true)),
    getAllUserResearchLevels(db),
    db.select({ userId: empireProgression.userId, level: empireProgression.level }).from(empireProgression),
    db.select({ userId: empirePolicies.userId, active: empirePolicies.active }).from(empirePolicies),
    db.select({ userId: planets.userId, status: planets.status }).from(planets),
  ]);

  const biomeIdsByPlanet = new Map<string, string[]>();
  for (const row of biomeRows) {
    const list = biomeIdsByPlanet.get(row.planetId);
    if (list) list.push(row.biomeId);
    else biomeIdsByPlanet.set(row.planetId, [row.biomeId]);
  }

  const capacityByUser = new Map<string, number>();
  for (const row of progressionRows) {
    capacityByUser.set(row.userId, empireGovernanceCapacity(row.level, levelConfig));
  }
  const defaultCapacity = empireGovernanceCapacity(1, levelConfig);

  const policyDeltaByUser = new Map<string, number>();
  for (const row of policyRows) {
    policyDeltaByUser.set(row.userId, policyEffects(row.active as Record<string, string>).productionDelta);
  }

  // Colonies actives par joueur — même définition que le chemin par planète :
  // planètes actives moins la planète-mère.
  const activeCountByUser = new Map<string, number>();
  for (const row of planetRows) {
    if (row.status === 'active') {
      activeCountByUser.set(row.userId, (activeCountByUser.get(row.userId) ?? 0) + 1);
    }
  }

  return function factsFor(
    planetId: string,
    userId: string,
    planet: PlanetBonusInput,
  ): BonusFacts {
    return {
      talentCtx: opts?.talentCtxFor?.(userId, planetId) ?? {},
      biomeBonuses: aggregateActiveBiomes(biomeIdsByPlanet.get(planetId) ?? [], config),
      researchLevels: researchByUser.get(userId) ?? {},
      governanceHarvestMalus: resolveHarvestMalus(
        planet.planetClassId === homeworldTypeId,
        Math.max(0, (activeCountByUser.get(userId) ?? 1) - 1),
        capacityByUser.get(userId) ?? defaultCapacity,
        config,
      ),
      vocation: planet.vocation,
      policyProductionDelta: policyDeltaByUser.get(userId) ?? 0,
    };
  };
}
