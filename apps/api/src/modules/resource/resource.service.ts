import { eq, and } from 'drizzle-orm';
import { byUser } from '../../lib/db-helpers.js';
import { TRPCError } from '@trpc/server';
import { planets, planetBuildings, planetShips } from '@exilium/db';
import type { Database } from '@exilium/db';
import {
  calculateResources,
  calculateProductionRates,
  type ResourceCost,
  type PlanetTypeBonus,
} from '@exilium/game-engine';
import { findBuildingByRole, findPlanetTypeByRole } from '../../lib/config-helpers.js';
import { buildProductionConfig } from '../../lib/production-config.js';
import {
  assembleBonusContext,
  createPerPlanetBonusLoader,
  type BonusBreakdownEntry,
} from './bonus-context.js';
import type { GameConfig, GameConfigService } from '../admin/game-config.service.js';
import type { createDailyQuestService } from '../daily-quest/daily-quest.service.js';

/**
 * Le détail des bonus appliqués à une planète — pour que le front AFFICHE ce
 * que le serveur APPLIQUE, sans jamais re-calculer de son côté.
 * Défini dans `bonus-context.ts` (la source de vérité de l'assemblage) et
 * ré-exporté ici pour les appelants historiques.
 */
export type { BonusBreakdownEntry };

function lookupPlanetTypeBonus(config: GameConfig, planetClassId: string | null): PlanetTypeBonus | undefined {
  if (!planetClassId) return undefined;
  const pt = config.planetTypes.find((t) => t.id === planetClassId);
  if (!pt) return undefined;
  return {
    mineraiBonus: pt.mineraiBonus,
    siliciumBonus: pt.siliciumBonus,
    hydrogeneBonus: pt.hydrogeneBonus,
  };
}

async function getBuildingLevels(db: Database, planetId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ buildingId: planetBuildings.buildingId, level: planetBuildings.level })
    .from(planetBuildings)
    .where(eq(planetBuildings.planetId, planetId));
  const levels: Record<string, number> = {};
  for (const row of rows) {
    levels[row.buildingId] = row.level;
  }
  return levels;
}

async function getSolarSatelliteCount(db: Database, planetId: string): Promise<number> {
  const [row] = await db
    .select({ solarSatellite: planetShips.solarSatellite })
    .from(planetShips)
    .where(eq(planetShips.planetId, planetId))
    .limit(1);
  return row?.solarSatellite ?? 0;
}

async function buildPlanetLevels(
  db: Database,
  planetId: string,
  planet: {
    maxTemp: number;
    mineraiMinePercent: number;
    siliciumMinePercent: number;
    hydrogeneSynthPercent: number;
    shieldPercent?: number | null;
    planetClassId?: string | null;
  },
  roleMap: {
    producerMinerai: string;
    producerSilicium: string;
    producerHydrogene: string;
    producerEnergy: string;
    storageMinerai: string;
    storageSilicium: string;
    storageHydrogene: string;
    homeworldTypeId: string;
  },
) {
  const [buildingLevels, solarSatelliteCount] = await Promise.all([
    getBuildingLevels(db, planetId),
    getSolarSatelliteCount(db, planetId),
  ]);
  return {
    mineraiMineLevel: buildingLevels[roleMap.producerMinerai] ?? 0,
    siliciumMineLevel: buildingLevels[roleMap.producerSilicium] ?? 0,
    hydrogeneSynthLevel: buildingLevels[roleMap.producerHydrogene] ?? 0,
    solarPlantLevel: buildingLevels[roleMap.producerEnergy] ?? 0,
    storageMineraiLevel: buildingLevels[roleMap.storageMinerai] ?? 0,
    storageSiliciumLevel: buildingLevels[roleMap.storageSilicium] ?? 0,
    storageHydrogeneLevel: buildingLevels[roleMap.storageHydrogene] ?? 0,
    maxTemp: planet.maxTemp,
    solarSatelliteCount,
    isHomePlanet: planet.planetClassId === roleMap.homeworldTypeId,
    mineraiMinePercent: planet.mineraiMinePercent,
    siliciumMinePercent: planet.siliciumMinePercent,
    hydrogeneSynthPercent: planet.hydrogeneSynthPercent,
    planetaryShieldLevel: buildingLevels['planetaryShield'] ?? 0,
    shieldPercent: planet.shieldPercent ?? 100,
  };
}

export function createResourceService(
  db: Database,
  gameConfigService: GameConfigService,
  dailyQuestService?: ReturnType<typeof createDailyQuestService>,
  talentService?: { computeTalentContext(userId: string, planetId?: string): Promise<Record<string, number>> },
) {
  async function getRoleMap() {
    const config = await gameConfigService.getFullConfig();
    return {
      producerMinerai: findBuildingByRole(config, 'producer_minerai').id,
      producerSilicium: findBuildingByRole(config, 'producer_silicium').id,
      producerHydrogene: findBuildingByRole(config, 'producer_hydrogene').id,
      producerEnergy: findBuildingByRole(config, 'producer_energy').id,
      storageMinerai: findBuildingByRole(config, 'storage_minerai').id,
      storageSilicium: findBuildingByRole(config, 'storage_silicium').id,
      storageHydrogene: findBuildingByRole(config, 'storage_hydrogene').id,
      homeworldTypeId: findPlanetTypeByRole(config, 'homeworld').id,
    };
  }

  /**
   * Assemble le contexte de bonus additifs — délégué à `bonus-context.ts`,
   * l'UNIQUE endroit où talents, biomes, recherche, gouvernance, vocation et
   * politiques se cumulent, partagé avec le tick du worker.
   *
   * materializeResources, spendResources et getProductionRates passent tous
   * par ici : l'accumulation réelle et les taux affichés ne peuvent plus
   * diverger. La recherche énergie n'est plus conditionnelle (décision D1).
   */
  async function buildBonusContext(
    planetId: string,
    userId: string | undefined,
    planet: { planetClassId?: string | null; vocation?: string | null },
    config: GameConfig,
  ): Promise<{ ctx: Record<string, number>; breakdown: BonusBreakdownEntry[] }> {
    const loadFacts = createPerPlanetBonusLoader(db, config, talentService);
    const facts = await loadFacts(planetId, userId, planet);
    return assembleBonusContext(facts, config);
  }

  return {
    async getBuildingLevels(planetId: string): Promise<Record<string, number>> {
      return getBuildingLevels(db, planetId);
    },

    /**
     * Contexte de bonus fusionné (talents + biomes + recherche + gouvernance +
     * vocation) d'une planète, expose pour les appelants exterieurs a ce
     * service qui doivent raisonner sur la MEME capacite de stockage que la
     * production — en particulier le calcul des ressources protegees lors d'un
     * pillage. Sans lui, `attack.handler` ne voyait que le contexte talent brut
     * et ignorait le bonus de stockage des biomes.
     */
    async getBonusContext(planetId: string, userId: string): Promise<Record<string, number>> {
      const [planet] = await db.select().from(planets).where(eq(planets.id, planetId)).limit(1);
      if (!planet) return {};
      const config = await gameConfigService.getFullConfig();
      const { ctx } = await buildBonusContext(planetId, userId, planet, config);
      return ctx;
    },

    async materializeResources(planetId: string, userId: string) {
      const [planet] = await db
        .select()
        .from(planets)
        .where(and(eq(planets.id, planetId), byUser(planets.userId, userId)))
        .limit(1);

      if (!planet) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (planet.status === 'colonizing') {
        return planet; // No resource production on colonizing planets
      }

      const config = await gameConfigService.getFullConfig();
      const bonus = lookupPlanetTypeBonus(config, planet.planetClassId);
      const roleMap = await getRoleMap();
      const levels = await buildPlanetLevels(db, planetId, planet, roleMap);
      const prodConfig = buildProductionConfig(config);
      const { ctx: talentCtx } = await buildBonusContext(planetId, userId, planet, config);

      const now = new Date();
      const resources = calculateResources(
        {
          minerai: Number(planet.minerai),
          silicium: Number(planet.silicium),
          hydrogene: Number(planet.hydrogene),
          ...levels,
        },
        planet.resourcesUpdatedAt,
        now,
        bonus,
        prodConfig,
        talentCtx,
      );

      const [updated] = await db
        .update(planets)
        .set({
          minerai: String(resources.minerai),
          silicium: String(resources.silicium),
          hydrogene: String(resources.hydrogene),
          resourcesUpdatedAt: now,
        })
        .where(eq(planets.id, planetId))
        .returning();

      // Hook: daily quest detection for resource collection
      const totalCollected = Math.floor(
        (resources.minerai - Number(planet.minerai)) +
        (resources.silicium - Number(planet.silicium)) +
        (resources.hydrogene - Number(planet.hydrogene))
      );
      if (dailyQuestService && totalCollected > 0) {
        await dailyQuestService.processEvent({
          type: 'resources:collected',
          userId,
          payload: { totalCollected },
        }).catch((e) => console.warn('[daily-quest] processEvent failed:', e));
      }

      return updated;
    },

    async spendResources(planetId: string, userId: string, cost: ResourceCost) {
      const [planet] = await db
        .select()
        .from(planets)
        .where(and(eq(planets.id, planetId), byUser(planets.userId, userId)))
        .limit(1);

      if (!planet) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const config = await gameConfigService.getFullConfig();
      const bonus = lookupPlanetTypeBonus(config, planet.planetClassId);
      const roleMap = await getRoleMap();
      const levels = await buildPlanetLevels(db, planetId, planet, roleMap);
      const prodConfig = buildProductionConfig(config);
      const { ctx: talentCtx } = await buildBonusContext(planetId, userId, planet, config);

      const now = new Date();
      const produced = calculateResources(
        {
          minerai: Number(planet.minerai),
          silicium: Number(planet.silicium),
          hydrogene: Number(planet.hydrogene),
          ...levels,
        },
        planet.resourcesUpdatedAt,
        now,
        bonus,
        prodConfig,
        talentCtx,
      );

      if (produced.minerai < cost.minerai || produced.silicium < cost.silicium || produced.hydrogene < cost.hydrogene) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ressources insuffisantes' });
      }

      const [result] = await db
        .update(planets)
        .set({
          minerai: String(produced.minerai - cost.minerai),
          silicium: String(produced.silicium - cost.silicium),
          hydrogene: String(produced.hydrogene - cost.hydrogene),
          resourcesUpdatedAt: now,
        })
        .where(and(eq(planets.id, planetId), byUser(planets.userId, userId)))
        .returning();

      if (!result) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ressources insuffisantes' });
      }

      return result;
    },

    async setProductionPercent(
      planetId: string,
      userId: string,
      percents: { mineraiMinePercent?: number; siliciumMinePercent?: number; hydrogeneSynthPercent?: number },
    ) {
      // Materialize resources first so accumulated production with old % isn't lost
      await this.materializeResources(planetId, userId);

      const updates: Partial<{ mineraiMinePercent: number; siliciumMinePercent: number; hydrogeneSynthPercent: number }> = {};
      if (percents.mineraiMinePercent !== undefined) updates.mineraiMinePercent = percents.mineraiMinePercent;
      if (percents.siliciumMinePercent !== undefined) updates.siliciumMinePercent = percents.siliciumMinePercent;
      if (percents.hydrogeneSynthPercent !== undefined) updates.hydrogeneSynthPercent = percents.hydrogeneSynthPercent;

      if (Object.keys(updates).length === 0) return;

      await db
        .update(planets)
        .set(updates)
        .where(and(eq(planets.id, planetId), byUser(planets.userId, userId)));
    },

    async getProductionRates(planetId: string, planet: {
      maxTemp: number;
      mineraiMinePercent: number;
      siliciumMinePercent: number;
      hydrogeneSynthPercent: number;
      shieldPercent?: number | null;
      planetClassId?: string | null;
      vocation?: string | null;
      sortOrder?: number;
      status?: string | null;
    }, bonus?: PlanetTypeBonus, userId?: string) {
      if (planet.status === 'colonizing') {
        return {
          mineraiPerHour: 0,
          siliciumPerHour: 0,
          hydrogenePerHour: 0,
          productionFactor: 0,
          mineraiMultiplier: 1,
          siliciumMultiplier: 1,
          hydrogeneMultiplier: 1,
          energyMultiplier: 1,
          energyProduced: 0,
          energyConsumed: 0,
          mineraiMineEnergyConsumption: 0,
          siliciumMineEnergyConsumption: 0,
          hydrogeneSynthEnergyConsumption: 0,
          shieldEnergyConsumption: 0,
          shieldPercent: 0,
          mineraiMinePercent: 0,
          siliciumMinePercent: 0,
          hydrogeneSynthPercent: 0,
          storageMineraiCapacity: 0,
          storageSiliciumCapacity: 0,
          storageHydrogeneCapacity: 0,
          bonuses: [] as BonusBreakdownEntry[],
        };
      }

      const roleMap = await getRoleMap();
      const levels = await buildPlanetLevels(db, planetId, planet, roleMap);
      const config = await gameConfigService.getFullConfig();
      const prodConfig = buildProductionConfig(config);

      // Exactement le même assemblage que l'accrual (materialize/spend) et que
      // le tick du worker — c'est la garantie du « affiché = versé ».
      const { ctx: talentCtx, breakdown } = await buildBonusContext(planetId, userId, planet, config);

      // Type de planète : multiplicatif côté moteur (param bonus), converti en
      // delta dans le détail pour que l'affichage soit complet.
      if (bonus) {
        const typeDeltas = [
          ['production_minerai', (bonus.mineraiBonus ?? 1) - 1],
          ['production_silicium', (bonus.siliciumBonus ?? 1) - 1],
          ['production_hydrogene', (bonus.hydrogeneBonus ?? 1) - 1],
        ] as const;
        for (const [stat, modifier] of typeDeltas) {
          if (modifier !== 0) breakdown.push({ source: 'type_planete', stat, modifier });
        }
      }

      const rates = calculateProductionRates(levels, bonus, prodConfig, talentCtx);
      return { ...rates, bonuses: breakdown };
    },
  };
}
