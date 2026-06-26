import { eq, and, sql, inArray } from 'drizzle-orm';
import { byUser } from '../../lib/db-helpers.js';
import { TRPCError } from '@trpc/server';
import { planets, buildQueue, planetBuildings, planetBiomes, userResearchLevels, userResearchChoices, researchDefinitions } from '@exilium/db';
import type { Database } from '@exilium/db';
import { findOwnedPlanet, getPlanetBuildingLevels } from '@exilium/db';
import {
  loadResearchLevels,
  bumpResearchLevel,
} from './research-levels.repo.js';
import {
  loadChoices,
  chooseFork,
  isResearchLocked,
} from './research-choices.repo.js';
import {
  researchCost,
  researchTime,
  checkResearchPrerequisites,
  resolveBonus,
  researchAnnexBonus,
  researchBiomeBonus,
} from '@exilium/game-engine';
import type { createResourceService } from '../resource/resource.service.js';
import type { GameConfigService } from '../admin/game-config.service.js';
import { getGovernancePenalty } from '../../lib/governance.js';
import type { Queue } from 'bullmq';
import type { BuildCompletionResult } from '../../workers/completion.types.js';
import type { createDailyQuestService } from '../daily-quest/daily-quest.service.js';
import type { createExiliumService } from '../exilium/exilium.service.js';

const ANNEX_BUILDING_IDS = ['labVolcanic', 'labArid', 'labTemperate', 'labGlacial', 'labGaseous'];

async function getAnnexLevelsSum(db: Database, userId: string): Promise<number> {
  const userPlanets = db.select({ id: planets.id }).from(planets).where(byUser(planets.userId, userId));

  const [result] = await db
    .select({ total: sql<number>`coalesce(sum(${planetBuildings.level}), 0)` })
    .from(planetBuildings)
    .where(
      and(
        inArray(planetBuildings.planetId, userPlanets),
        inArray(planetBuildings.buildingId, ANNEX_BUILDING_IDS),
      ),
    );
  return Number(result?.total ?? 0);
}

async function getActiveBiomesCount(db: Database, userId: string): Promise<number> {
  const userPlanets = db.select({ id: planets.id }).from(planets).where(byUser(planets.userId, userId));

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(planetBiomes)
    .where(and(inArray(planetBiomes.planetId, userPlanets), eq(planetBiomes.active, true)));
  return Number(result?.count ?? 0);
}

async function getAnnexDetails(
  db: Database,
  userId: string,
): Promise<{ buildingId: string; level: number; planetName: string }[]> {
  const rows = await db
    .select({
      buildingId: planetBuildings.buildingId,
      level: planetBuildings.level,
      planetName: planets.name,
    })
    .from(planetBuildings)
    .innerJoin(planets, eq(planets.id, planetBuildings.planetId))
    .where(
      and(byUser(planets.userId, userId), inArray(planetBuildings.buildingId, ANNEX_BUILDING_IDS)),
    );
  return rows;
}

async function hasAnnexOfType(db: Database, userId: string, annexType: string): Promise<boolean> {
  const annexBuildingId = `lab${annexType.charAt(0).toUpperCase()}${annexType.slice(1)}`;
  const userPlanets = db.select({ id: planets.id }).from(planets).where(byUser(planets.userId, userId));

  const [result] = await db
    .select({ level: planetBuildings.level })
    .from(planetBuildings)
    .where(
      and(
        inArray(planetBuildings.planetId, userPlanets),
        eq(planetBuildings.buildingId, annexBuildingId),
      ),
    )
    .limit(1);
  return (result?.level ?? 0) >= 1;
}

export function createResearchService(
  db: Database,
  resourceService: ReturnType<typeof createResourceService>,
  completionQueue: Queue,
  gameConfigService: GameConfigService,
  talentService?: {
    computeTalentContext(userId: string, planetId?: string): Promise<Record<string, number>>;
  },
  dailyQuestService?: ReturnType<typeof createDailyQuestService>,
  exiliumService?: ReturnType<typeof createExiliumService>,
) {
  return {
    async getHomeworld(userId: string) {
      const [homeworld] = await db
        .select()
        .from(planets)
        .where(and(byUser(planets.userId, userId), eq(planets.planetClassId, 'homeworld')))
        .limit(1);
      if (!homeworld)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Planete mere introuvable' });
      return homeworld;
    },

    async listResearch(userId: string) {
      const homeworld = await this.getHomeworld(userId);
      const planetId = homeworld.id;
      const levels = await loadResearchLevels(db, userId);
      const choices = await loadChoices(db, userId);
      const config = await gameConfigService.getFullConfig();
      const buildingLevels = await getPlanetBuildingLevels(db, planetId);

      const [activeResearch] = await db
        .select()
        .from(buildQueue)
        .where(
          and(
            byUser(buildQueue.userId, userId),
            eq(buildQueue.type, 'research'),
            eq(buildQueue.status, 'active'),
          ),
        )
        .limit(1);

      const phaseMap = config.universe.phase_multiplier
        ? Object.fromEntries(
            Object.entries(config.universe.phase_multiplier as Record<string, number>).map(
              ([k, v]) => [Number(k), v],
            ),
          )
        : undefined;
      const timeDivisor = Number(config.universe.research_time_divisor) || 1000;
      // For empire-level research: get global talents (no planet restriction)
      // then get hull bonus separately (always active for research, regardless of flagship location)
      const talentCtx = talentService ? await talentService.computeTalentContext(userId) : {};
      const talentTimeMultiplier = 1 - (talentCtx['research_time'] ?? 0);
      // Hull bonus is returned by computeTalentContext regardless of planetId
      const hullTimeMultiplier = 1 - (talentCtx['hull_research_time_reduction'] ?? 0);

      const annexLevelsSum = await getAnnexLevelsSum(db, userId);
      const annexBonusMultiplier = researchAnnexBonus(annexLevelsSum);
      const discoveredBiomesCount = await getActiveBiomesCount(db, userId);
      const biomeBonusMultiplier = researchBiomeBonus(discoveredBiomesCount);
      const bonusMultiplier = resolveBonus('research_time', null, buildingLevels, config.bonuses);
      const annexDetails = await getAnnexDetails(db, userId);

      // Governance construction penalty (no-op on homeworld, applied for consistency)
      const govPenalty = await getGovernancePenalty(db, userId, homeworld.planetClassId, config);
      const govTimeMult = 1 + govPenalty.constructionMalus;

      const results = await Promise.all(
        Object.values(config.research)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(async (def) => {
            const currentLevel = levels[def.id] ?? 0;
            const nextLevel = currentLevel + 1;
            const cost = researchCost(def, nextLevel, phaseMap);
            const time = Math.max(
              1,
              Math.floor(
                researchTime(def, nextLevel, bonusMultiplier, { timeDivisor, phaseMap }) *
                  talentTimeMultiplier *
                  hullTimeMultiplier *
                  annexBonusMultiplier *
                  biomeBonusMultiplier *
                  govTimeMult,
              ),
            );

            const researchLevels: Record<string, number> = {};
            for (const [key] of Object.entries(config.research)) {
              researchLevels[key] = levels[key] ?? 0;
            }
            const prereqCheck = checkResearchPrerequisites(
              def.prerequisites,
              buildingLevels,
              researchLevels,
            );

            // Check annex prerequisite if required
            const requiredAnnex = def.requiredAnnexType;
            let annexMet = true;
            if (requiredAnnex) {
              annexMet = await hasAnnexOfType(db, userId, requiredAnnex);
            }

            const locked = isResearchLocked(def, choices);
            return {
              id: def.id,
              name: def.name,
              description: def.description,
              currentLevel,
              maxLevel: def.maxLevel ?? null,
              nextLevelCost: cost,
              nextLevelTime: time,
              prerequisitesMet: prereqCheck.met && annexMet,
              missingPrerequisites: [
                ...prereqCheck.missing,
                ...(requiredAnnex && !annexMet ? [`Requires annex: ${requiredAnnex}`] : []),
              ],
              requiredAnnexType: requiredAnnex ?? null,
              isResearching: activeResearch?.itemId === def.id,
              researchEndTime:
                activeResearch?.itemId === def.id ? activeResearch.endTime.toISOString() : null,
              // Arbre de recherche (S1 research-trees)
              branchId: def.branchId ?? null,
              tier: def.tier ?? null,
              forkId: def.forkId ?? null,
              forkPath: def.forkPath ?? null,
              locked,
            };
          }),
      );
      return {
        items: results,
        bonuses: {
          labLevel: buildingLevels['researchLab'] ?? 0,
          labMultiplier: bonusMultiplier,
          annexLevelsSum,
          annexMultiplier: annexBonusMultiplier,
          annexDetails,
          discoveredBiomesCount,
          biomeMultiplier: biomeBonusMultiplier,
          talentMultiplier: talentTimeMultiplier,
          hullMultiplier: hullTimeMultiplier,
          totalMultiplier:
            bonusMultiplier *
            annexBonusMultiplier *
            biomeBonusMultiplier *
            talentTimeMultiplier *
            hullTimeMultiplier,
        },
      };
    },

    async startResearch(userId: string, researchId: string) {
      const homeworld = await this.getHomeworld(userId);

      if (homeworld.status === 'colonizing') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Construction impossible pendant la colonisation',
        });
      }

      const planetId = homeworld.id;
      const levels = await loadResearchLevels(db, userId);
      const config = await gameConfigService.getFullConfig();
      const def = config.research[researchId];
      if (!def) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Recherche invalide' });

      // Fork gating — reject if this research belongs to a fork path not chosen by this user
      const choices = await loadChoices(db, userId);
      if (isResearchLocked(def, choices)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Recherche verrouillée : vous avez choisi une voie différente pour le fork ${def.forkId}.`,
        });
      }

      const [activeResearch] = await db
        .select()
        .from(buildQueue)
        .where(
          and(
            byUser(buildQueue.userId, userId),
            eq(buildQueue.type, 'research'),
            eq(buildQueue.status, 'active'),
          ),
        )
        .limit(1);

      if (activeResearch) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Recherche déjà en cours' });
      }

      const buildingLevels = await getPlanetBuildingLevels(db, planetId);
      const researchLevels: Record<string, number> = {};
      for (const [key] of Object.entries(config.research)) {
        researchLevels[key] = levels[key] ?? 0;
      }
      const prereqCheck = checkResearchPrerequisites(
        def.prerequisites,
        buildingLevels,
        researchLevels,
      );
      if (!prereqCheck.met) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Prérequis non remplis: ${prereqCheck.missing.join(', ')}`,
        });
      }

      // Check annex prerequisite
      const requiredAnnex = def.requiredAnnexType;
      if (requiredAnnex) {
        const hasAnnex = await hasAnnexOfType(db, userId, requiredAnnex);
        if (!hasAnnex) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Annexe requise : ${requiredAnnex}`,
          });
        }
      }

      const currentLevel = levels[researchId] ?? 0;
      const nextLevel = currentLevel + 1;
      if (def.maxLevel != null && nextLevel > def.maxLevel) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Niveau maximum atteint (${def.maxLevel})`,
        });
      }
      const phaseMap = config.universe.phase_multiplier
        ? Object.fromEntries(
            Object.entries(config.universe.phase_multiplier as Record<string, number>).map(
              ([k, v]) => [Number(k), v],
            ),
          )
        : undefined;
      const timeDivisor = Number(config.universe.research_time_divisor) || 1000;
      const cost = researchCost(def, nextLevel, phaseMap);
      const bonusMultiplier = resolveBonus('research_time', null, buildingLevels, config.bonuses);
      // Empire-level: global talents + hull bonus (always returned by computeTalentContext)
      const talentCtx = talentService ? await talentService.computeTalentContext(userId) : {};
      const talentTimeMultiplier = 1 - (talentCtx['research_time'] ?? 0);
      const hullTimeMultiplier = 1 - (talentCtx['hull_research_time_reduction'] ?? 0);
      const annexLevelsSum = await getAnnexLevelsSum(db, userId);
      const annexBonusMultiplier = researchAnnexBonus(annexLevelsSum);
      const discoveredBiomesCount = await getActiveBiomesCount(db, userId);
      const biomeBonusMultiplier = researchBiomeBonus(discoveredBiomesCount);
      // Governance construction penalty (no-op on homeworld, applied for consistency)
      const govPenaltyResearch = await getGovernancePenalty(
        db,
        userId,
        homeworld.planetClassId,
        config,
      );
      const govTimeMultResearch = 1 + govPenaltyResearch.constructionMalus;
      const time = Math.max(
        1,
        Math.floor(
          researchTime(def, nextLevel, bonusMultiplier, { timeDivisor, phaseMap }) *
            talentTimeMultiplier *
            hullTimeMultiplier *
            annexBonusMultiplier *
            biomeBonusMultiplier *
            govTimeMultResearch,
        ),
      );

      await resourceService.spendResources(planetId, userId, cost);

      const now = new Date();
      const endTime = new Date(now.getTime() + time * 1000);

      const [entry] = await db
        .insert(buildQueue)
        .values({
          planetId,
          userId,
          type: 'research',
          itemId: researchId,
          startTime: now,
          endTime,
          status: 'active',
        })
        .returning();

      await completionQueue.add(
        'research',
        { buildQueueId: entry.id },
        { delay: time * 1000, jobId: `research-${entry.id}` },
      );

      // Hook: daily quest detection for construction start
      if (dailyQuestService) {
        dailyQuestService
          .processEvent({
            type: 'construction:started',
            userId,
            payload: { researchId },
          })
          .catch((e) => console.warn('[daily-quest] processEvent failed:', e));
      }

      return { entry, endTime: endTime.toISOString(), researchTime: time };
    },

    async cancelResearch(userId: string) {
      const [activeResearch] = await db
        .select()
        .from(buildQueue)
        .where(
          and(
            byUser(buildQueue.userId, userId),
            eq(buildQueue.type, 'research'),
            eq(buildQueue.status, 'active'),
          ),
        )
        .limit(1);

      if (!activeResearch) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Aucune recherche en cours' });
      }

      const config = await gameConfigService.getFullConfig();
      const cancelRefundRatio = Number(config.universe.cancel_refund_ratio) || 0.7;
      const def = config.research[activeResearch.itemId];
      const levels = await loadResearchLevels(db, userId);
      const currentLevel = def ? (levels[activeResearch.itemId] ?? 0) : 0;
      const phaseMap = config.universe.phase_multiplier
        ? Object.fromEntries(
            Object.entries(config.universe.phase_multiplier as Record<string, number>).map(
              ([k, v]) => [Number(k), v],
            ),
          )
        : undefined;
      const cost = def
        ? researchCost(def, currentLevel + 1, phaseMap)
        : { minerai: 0, silicium: 0, hydrogene: 0 };

      // Pro-rata refund capped at 70%
      const now = Date.now();
      const totalDuration =
        new Date(activeResearch.endTime).getTime() - new Date(activeResearch.startTime).getTime();
      const remaining = Math.max(0, new Date(activeResearch.endTime).getTime() - now);
      const refundRatio = Math.min(
        cancelRefundRatio,
        totalDuration > 0 ? remaining / totalDuration : 0,
      );
      const refund = {
        minerai: Math.floor(cost.minerai * refundRatio),
        silicium: Math.floor(cost.silicium * refundRatio),
        hydrogene: Math.floor(cost.hydrogene * refundRatio),
      };

      const [planet] = await db
        .select()
        .from(planets)
        .where(eq(planets.id, activeResearch.planetId))
        .limit(1);

      if (planet) {
        await db
          .update(planets)
          .set({
            minerai: String(Number(planet.minerai) + refund.minerai),
            silicium: String(Number(planet.silicium) + refund.silicium),
            hydrogene: String(Number(planet.hydrogene) + refund.hydrogene),
          })
          .where(eq(planets.id, planet.id));
      }

      await completionQueue.remove(`research-${activeResearch.id}`);
      await db.delete(buildQueue).where(eq(buildQueue.id, activeResearch.id));

      return { cancelled: true, refund };
    },

    async completeResearch(buildQueueId: string): Promise<BuildCompletionResult> {
      const [entry] = await db
        .select()
        .from(buildQueue)
        .where(and(eq(buildQueue.id, buildQueueId), eq(buildQueue.status, 'active')))
        .limit(1);

      if (!entry) return null;

      const config = await gameConfigService.getFullConfig();
      const def = config.research[entry.itemId];
      if (!def) return null;

      const newLevel = await bumpResearchLevel(db, entry.userId, entry.itemId);

      await db
        .update(buildQueue)
        .set({ status: 'completed' })
        .where(eq(buildQueue.id, buildQueueId));

      // NEW: fetch planet name and build standardized result
      const [planet] = await db
        .select({ name: planets.name })
        .from(planets)
        .where(eq(planets.id, entry.planetId))
        .limit(1);

      const techName = config.research[entry.itemId]?.name ?? entry.itemId;
      const planetName = planet?.name ?? 'Planète';

      return {
        userId: entry.userId,
        planetId: entry.planetId,
        eventType: 'research-done',
        notificationPayload: {
          planetId: entry.planetId,
          planetName,
          techId: entry.itemId,
          name: techName,
          level: newLevel,
        },
        eventPayload: {
          techId: entry.itemId,
          name: techName,
          level: newLevel,
          planetName,
        },
        tutorialCheck: {
          type: 'research_level',
          targetId: entry.itemId,
          targetValue: newLevel,
        },
      };
    },

    async chooseFork(userId: string, forkId: string, path: string): Promise<void> {
      await chooseFork(db, userId, forkId, path);
    },

    /**
     * Respec d'un fork de recherche.
     *
     * - Coût = `research_respec_base × research_respec_factor ^ respecCount`
     * - Remet à 0 les `user_research_levels` de TOUTES les recherches de l'ancienne voie
     *   (même `forkId` et ancienne `forkPath`)
     * - Upsert `chosenPath = newPath` + `respecCount++`
     * - Transactionnel
     */
    async respecFork(userId: string, forkId: string, newPath: string): Promise<void> {
      if (!exiliumService) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'ExiliumService non disponible (respecFork)',
        });
      }

      const config = await gameConfigService.getFullConfig();
      const respecBase = Number(config.universe['research_respec_base']) || 5;
      const respecFactor = Number(config.universe['research_respec_factor']) || 2;

      await db.transaction(async (tx) => {
        // 1. Load current choice (for-update)
        const choices = await loadChoices(tx, userId);
        const current = choices[forkId];

        if (!current) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Aucun choix de fork enregistré pour forkId=${forkId}. Utilisez chooseFork d'abord.`,
          });
        }

        if (current.path === newPath) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Vous êtes déjà sur la voie ${newPath}.`,
          });
        }

        const { respecCount, path: oldPath } = current;

        // 2. Compute cost and debit exilium (uses its own internal transaction)
        const cost = Math.round(respecBase * Math.pow(respecFactor, respecCount));
        await exiliumService.spend(userId, cost, 'respec', {
          forkId,
          fromPath: oldPath,
          toPath: newPath,
        });

        // 3. Find all research definitions belonging to the OLD path of this fork
        const oldPathResearches = await tx
          .select({ id: researchDefinitions.id })
          .from(researchDefinitions)
          .where(
            and(
              eq(researchDefinitions.forkId, forkId),
              eq(researchDefinitions.forkPath, oldPath),
            ),
          );

        // 4. Zero out user_research_levels for the old path researches
        if (oldPathResearches.length > 0) {
          const oldIds = oldPathResearches.map((r) => r.id);
          await tx
            .update(userResearchLevels)
            .set({ level: 0 })
            .where(
              and(
                eq(userResearchLevels.userId, userId),
                inArray(userResearchLevels.researchId, oldIds),
              ),
            );
        }

        // 5. Upsert the fork choice with new path and incremented respecCount
        await tx
          .insert(userResearchChoices)
          .values({
            userId,
            forkId,
            chosenPath: newPath,
            respecCount: (respecCount + 1) as number,
          })
          .onConflictDoUpdate({
            target: [userResearchChoices.userId, userResearchChoices.forkId],
            set: {
              chosenPath: newPath,
              respecCount: (respecCount + 1) as number,
            },
          });
      });
    },

    async getOwnedPlanet(userId: string, planetId: string) {
      const planet = await findOwnedPlanet(db, userId, planetId);

      if (!planet) throw new TRPCError({ code: 'NOT_FOUND' });
      return planet;
    },
  };
}
