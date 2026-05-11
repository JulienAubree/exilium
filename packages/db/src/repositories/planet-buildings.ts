import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../connection.js';
import { planetBuildings } from '../schema/planet-buildings.js';

/**
 * Charge les niveaux de bâtiments d'une planète sous forme de map `{ [buildingId]: level }`.
 * Les bâtiments non présents ne sont pas dans la map (au caller de fallback à 0).
 */
export async function getPlanetBuildingLevels(
  db: DbOrTx,
  planetId: string,
): Promise<Record<string, number>> {
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
