import { sql } from 'drizzle-orm';
import { planets, planetTypes, planetBuildings, planetShips } from '@exilium/db';
import type { Database } from '@exilium/db';
import { calculateResources } from '@exilium/game-engine';
import { findBuildingByRole, findPlanetTypeByRole } from '../lib/config-helpers.js';
import { buildProductionConfig } from '../lib/production-config.js';
import { assembleBonusContext, createBatchBonusLoader } from '../modules/resource/bonus-context.js';
import type { GameConfigService } from '../modules/admin/game-config.service.js';

/**
 * Apply a list of per-planet resource updates as a single SQL round-trip via
 * `UPDATE ... FROM (VALUES ...)`. Previous implementation ran N×UPDATE in a
 * for-await loop which at 50k planets was ~50k round-trips every 15 min.
 *
 * Batches of 2000 keep the bind-parameter count bounded (8k params per batch)
 * and the WHERE in plan tree manageable on Postgres 17.
 */
async function batchUpdateResources(
  db: Database,
  rows: Array<{
    id: string;
    minerai: string;
    silicium: string;
    hydrogene: string;
    updatedAt: string;
    prevUpdatedAt: string;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  const BATCH = 2000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values = sql.join(
      slice.map(
        (r) =>
          sql`(${r.id}::uuid, ${r.minerai}::numeric, ${r.silicium}::numeric, ${r.hydrogene}::numeric, ${r.updatedAt}::timestamptz, ${r.prevUpdatedAt}::timestamptz)`,
      ),
      sql`, `,
    );
    // `AND p.resources_updated_at = v.prev` ferme la course avec l'accrual de
    // l'API : entre la lecture du lot et son écriture, un joueur peut avoir
    // dépensé (spendResources matérialise et avance resources_updated_at). Sans
    // ce garde, le tick réécrivait un solde calculé sur un état périmé et
    // effaçait la dépense. Les lignes perdantes sont simplement sautées — elles
    // viennent d'être matérialisées par l'API, donc elles sont déjà à jour, et
    // le tick suivant les reprendra normalement.
    await db.execute(sql`
      UPDATE ${planets} AS p
      SET minerai = v.minerai,
          silicium = v.silicium,
          hydrogene = v.hydrogene,
          resources_updated_at = v.t
      FROM (VALUES ${values}) AS v(id, minerai, silicium, hydrogene, t, prev)
      WHERE p.id = v.id
        AND p.resources_updated_at = v.prev
    `);
  }
}

export async function resourceTick(db: Database, gameConfigService: GameConfigService) {
  const now = new Date();
  // Projection : on ne tire que les 12 colonnes réellement consommées par
  // la boucle (sur les 23 du schema). Réduit le payload de ~50% à 50k+
  // planets, ce qui dégage de la mémoire et du temps de désérialisation.
  const allPlanets = await db
    .select({
      id: planets.id,
      userId: planets.userId,
      status: planets.status,
      planetClassId: planets.planetClassId,
      minerai: planets.minerai,
      silicium: planets.silicium,
      hydrogene: planets.hydrogene,
      maxTemp: planets.maxTemp,
      mineraiMinePercent: planets.mineraiMinePercent,
      siliciumMinePercent: planets.siliciumMinePercent,
      hydrogeneSynthPercent: planets.hydrogeneSynthPercent,
      resourcesUpdatedAt: planets.resourcesUpdatedAt,
      vocation: planets.vocation,
      // Le bouclier planétaire consomme de l'énergie. Le tick l'ignorait, donc
      // il calculait un facteur d'énergie trop favorable et SURPAYAIT les
      // planètes protégées — l'unique poste où il était plus généreux que
      // l'affichage.
      shieldPercent: planets.shieldPercent,
    })
    .from(planets);

  // Pre-load all planet types for bonus lookup
  const ptRows = await db.select().from(planetTypes);
  const ptMap = new Map(
    ptRows.map((pt) => [
      pt.id,
      {
        mineraiBonus: pt.mineraiBonus,
        siliciumBonus: pt.siliciumBonus,
        hydrogeneBonus: pt.hydrogeneBonus,
      },
    ]),
  );

  // Pre-load all building levels (projection : 3 colonnes au lieu de tout
  // le schema planet_buildings).
  const allBuildingRows = await db
    .select({
      planetId: planetBuildings.planetId,
      buildingId: planetBuildings.buildingId,
      level: planetBuildings.level,
    })
    .from(planetBuildings);
  const buildingLevelsMap = new Map<string, Record<string, number>>();
  for (const row of allBuildingRows) {
    if (!buildingLevelsMap.has(row.planetId)) {
      buildingLevelsMap.set(row.planetId, {});
    }
    buildingLevelsMap.get(row.planetId)![row.buildingId] = row.level;
  }

  // Pre-load solar satellite counts
  const allShipRows = await db
    .select({ planetId: planetShips.planetId, solarSatellite: planetShips.solarSatellite })
    .from(planetShips);
  const satCountMap = new Map<string, number>();
  for (const row of allShipRows) {
    satCountMap.set(row.planetId, row.solarSatellite);
  }

  // Resolve building IDs by role
  const config = await gameConfigService.getFullConfig();
  const prodConfig = buildProductionConfig(config);
  const mineraiMineId = findBuildingByRole(config, 'producer_minerai').id;
  const siliciumMineId = findBuildingByRole(config, 'producer_silicium').id;
  const hydrogeneSynthId = findBuildingByRole(config, 'producer_hydrogene').id;
  const solarPlantId = findBuildingByRole(config, 'producer_energy').id;
  const storageMineraiId = findBuildingByRole(config, 'storage_minerai').id;
  const storageSiliciumId = findBuildingByRole(config, 'storage_silicium').id;
  const storageHydrogeneId = findBuildingByRole(config, 'storage_hydrogene').id;
  const homeworldTypeId = findPlanetTypeByRole(config, 'homeworld').id;

  // Le contexte de bonus vient désormais de l'assembleur partagé avec l'API
  // (modules/resource/bonus-context.ts) : recherche production ET énergie,
  // biomes actifs, politiques d'empire, gouvernance et vocation, calculés par
  // le MÊME code que materializeResources et getProductionRates.
  //
  // Ce qui manquait ici et que le tick verse enfin : les biomes actifs, les
  // politiques d'empire et la production d'énergie de la recherche. Comme le
  // tick est le créditeur dominant, c'est l'essentiel de la fuite de ~19,4 %
  // entre l'affiché et le versé.
  //
  // Le chargeur précharge tout l'univers en 4 requêtes — le contrat de perf du
  // fichier (50k planètes, O(requêtes constantes)) est préservé.
  const factsFor = await createBatchBonusLoader(db, config);

  const nowIso = now.toISOString();
  const pendingUpdates: Array<{
    id: string;
    minerai: string;
    silicium: string;
    hydrogene: string;
    updatedAt: string;
    prevUpdatedAt: string;
  }> = [];
  let skippedColonizing = 0;
  for (const planet of allPlanets) {
    // Parité avec materializeResources : une planète en cours de colonisation
    // ne produit rien. Le tick la traitait comme les autres et réécrivait son
    // resources_updated_at, ce qui escamotait silencieusement le temps écoulé
    // avant la fin de la colonisation.
    if (planet.status === 'colonizing') {
      skippedColonizing++;
      continue;
    }

    const bonus = planet.planetClassId ? ptMap.get(planet.planetClassId) : undefined;
    const buildingLevels = buildingLevelsMap.get(planet.id) ?? {};

    const { ctx: talentBonuses } = assembleBonusContext(
      factsFor(planet.id, planet.userId, planet),
      config,
    );

    const resources = calculateResources(
      {
        minerai: Number(planet.minerai),
        silicium: Number(planet.silicium),
        hydrogene: Number(planet.hydrogene),
        mineraiMineLevel: buildingLevels[mineraiMineId] ?? 0,
        siliciumMineLevel: buildingLevels[siliciumMineId] ?? 0,
        hydrogeneSynthLevel: buildingLevels[hydrogeneSynthId] ?? 0,
        solarPlantLevel: buildingLevels[solarPlantId] ?? 0,
        storageMineraiLevel: buildingLevels[storageMineraiId] ?? 0,
        storageSiliciumLevel: buildingLevels[storageSiliciumId] ?? 0,
        storageHydrogeneLevel: buildingLevels[storageHydrogeneId] ?? 0,
        maxTemp: planet.maxTemp,
        solarSatelliteCount: satCountMap.get(planet.id) ?? 0,
        isHomePlanet: planet.planetClassId === homeworldTypeId,
        mineraiMinePercent: planet.mineraiMinePercent,
        siliciumMinePercent: planet.siliciumMinePercent,
        hydrogeneSynthPercent: planet.hydrogeneSynthPercent,
        // Même clé littérale que buildPlanetLevels côté API — c'est ce que le
        // tick omettait, d'où un facteur d'énergie surestimé sur les planètes
        // protégées.
        planetaryShieldLevel: buildingLevels['planetaryShield'] ?? 0,
        shieldPercent: planet.shieldPercent ?? 100,
      },
      planet.resourcesUpdatedAt,
      now,
      bonus,
      prodConfig,
      talentBonuses,
    );

    pendingUpdates.push({
      id: planet.id,
      minerai: String(resources.minerai),
      silicium: String(resources.silicium),
      hydrogene: String(resources.hydrogene),
      updatedAt: nowIso,
      prevUpdatedAt: planet.resourcesUpdatedAt.toISOString(),
    });
  }

  await batchUpdateResources(db, pendingUpdates);
  console.log(
    `[resource-tick] Materialized resources for ${pendingUpdates.length} planets` +
      (skippedColonizing > 0 ? ` (${skippedColonizing} colonizing skipped)` : ''),
  );
}
