import { eq } from 'drizzle-orm';
import { planets } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import { calculateResources } from '@ogame-clone/game-engine';

export async function resourceTick(db: Database) {
  const now = new Date();
  const allPlanets = await db.select().from(planets);

  let updated = 0;
  for (const planet of allPlanets) {
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

    await db
      .update(planets)
      .set({
        minerai: String(resources.minerai),
        silicium: String(resources.silicium),
        hydrogene: String(resources.hydrogene),
        resourcesUpdatedAt: now,
      })
      .where(eq(planets.id, planet.id));

    updated++;
  }

  console.log(`[resource-tick] Materialized resources for ${updated} planets`);
}
