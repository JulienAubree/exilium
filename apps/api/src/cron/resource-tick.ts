import { eq } from 'drizzle-orm';
import { planets, planetTypes } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import { calculateResources } from '@ogame-clone/game-engine';

export async function resourceTick(db: Database) {
  const now = new Date();
  const allPlanets = await db.select().from(planets);

  // Pre-load all planet types for bonus lookup
  const ptRows = await db.select().from(planetTypes);
  const ptMap = new Map(ptRows.map(pt => [pt.id, { mineraiBonus: pt.mineraiBonus, siliciumBonus: pt.siliciumBonus, hydrogeneBonus: pt.hydrogeneBonus }]));

  let updated = 0;
  for (const planet of allPlanets) {
    const bonus = planet.planetClassId ? ptMap.get(planet.planetClassId) : undefined;
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
      bonus,
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
