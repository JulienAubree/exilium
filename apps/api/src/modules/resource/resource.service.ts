import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { planets } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import {
  calculateResources,
  calculateProductionRates,
  type ResourceCost,
} from '@ogame-clone/game-engine';

export function createResourceService(db: Database) {
  return {
    async materializeResources(planetId: string, userId: string) {
      const [planet] = await db
        .select()
        .from(planets)
        .where(and(eq(planets.id, planetId), eq(planets.userId, userId)))
        .limit(1);

      if (!planet) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const now = new Date();
      const resources = calculateResources(
        {
          minerai: Number(planet.minerai),
          silicium: Number(planet.silicium),
          hydrogene: Number(planet.hydrogene),
          mineraiMineLevel: planet.mineraiMineLevel,
          siliciumMineLevel: planet.siliciumMineLevel,
          hydrogeneSynthLevel: planet.hydrogeneSynthLevel,
          solarPlantLevel: planet.solarPlantLevel,
          storageMineraiLevel: planet.storageMineraiLevel,
          storageSiliciumLevel: planet.storageSiliciumLevel,
          storageHydrogeneLevel: planet.storageHydrogeneLevel,
          maxTemp: planet.maxTemp,
          mineraiMinePercent: planet.mineraiMinePercent,
          siliciumMinePercent: planet.siliciumMinePercent,
          hydrogeneSynthPercent: planet.hydrogeneSynthPercent,
        },
        planet.resourcesUpdatedAt,
        now,
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

      return updated;
    },

    async spendResources(planetId: string, userId: string, cost: ResourceCost) {
      const [planet] = await db
        .select()
        .from(planets)
        .where(and(eq(planets.id, planetId), eq(planets.userId, userId)))
        .limit(1);

      if (!planet) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const now = new Date();
      const produced = calculateResources(
        {
          minerai: Number(planet.minerai),
          silicium: Number(planet.silicium),
          hydrogene: Number(planet.hydrogene),
          mineraiMineLevel: planet.mineraiMineLevel,
          siliciumMineLevel: planet.siliciumMineLevel,
          hydrogeneSynthLevel: planet.hydrogeneSynthLevel,
          solarPlantLevel: planet.solarPlantLevel,
          storageMineraiLevel: planet.storageMineraiLevel,
          storageSiliciumLevel: planet.storageSiliciumLevel,
          storageHydrogeneLevel: planet.storageHydrogeneLevel,
          maxTemp: planet.maxTemp,
          mineraiMinePercent: planet.mineraiMinePercent,
          siliciumMinePercent: planet.siliciumMinePercent,
          hydrogeneSynthPercent: planet.hydrogeneSynthPercent,
        },
        planet.resourcesUpdatedAt,
        now,
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
        .where(and(eq(planets.id, planetId), eq(planets.userId, userId)))
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
        .where(and(eq(planets.id, planetId), eq(planets.userId, userId)));
    },

    getProductionRates(planet: {
      mineraiMineLevel: number;
      siliciumMineLevel: number;
      hydrogeneSynthLevel: number;
      solarPlantLevel: number;
      storageMineraiLevel: number;
      storageSiliciumLevel: number;
      storageHydrogeneLevel: number;
      maxTemp: number;
      mineraiMinePercent: number;
      siliciumMinePercent: number;
      hydrogeneSynthPercent: number;
    }) {
      return calculateProductionRates(planet);
    },
  };
}
