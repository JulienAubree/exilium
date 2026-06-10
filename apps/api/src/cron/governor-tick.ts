import { eq, and, isNotNull, inArray } from 'drizzle-orm';
import { planets, buildQueue, empireProgression } from '@exilium/db';
import type { Database } from '@exilium/db';
import { governorCandidates, isGovernorDirective, buildEmpireLevelConfig } from '@exilium/game-engine';
import { findBuildingByRole } from '../lib/config-helpers.js';
import type { GameConfigService } from '../modules/admin/game-config.service.js';

interface BuildingServiceLike {
  startUpgrade(userId: string, planetId: string, buildingId: string): Promise<unknown>;
  getBuildings(userId: string, planetId: string): Promise<unknown>;
}

/**
 * Tick des gouverneurs (chantier Empire §5.3) : pour chaque planète sous
 * directive dont la file est libre, tente la construction prioritaire.
 * Une tentative par planète et par tick — startUpgrade porte toutes les
 * validations (coût, prérequis, énergie) ; un refus = on attend le suivant.
 */
export async function governorTick(
  db: Database,
  gameConfigService: GameConfigService,
  buildingService: { startUpgrade: BuildingServiceLike['startUpgrade'] },
  resourceService: { getProductionRates(planetId: string, planet: unknown, bonus?: unknown, userId?: string): Promise<{
    energyProduced: number; energyConsumed: number;
    storageMineraiCapacity: number; storageSiliciumCapacity: number; storageHydrogeneCapacity: number;
  }> },
) {
  const governed = await db
    .select()
    .from(planets)
    .where(and(isNotNull(planets.governor), eq(planets.status, 'active')));
  if (governed.length === 0) return { attempted: 0, started: 0 };

  // Files actives : une construction en cours = le gouverneur attend.
  const busyRows = await db
    .select({ planetId: buildQueue.planetId })
    .from(buildQueue)
    .where(and(
      inArray(buildQueue.planetId, governed.map((p) => p.id)),
      eq(buildQueue.type, 'building'),
      eq(buildQueue.status, 'active'),
    ));
  const busy = new Set(busyRows.map((r) => r.planetId));

  const config = await gameConfigService.getFullConfig();
  const roles = {
    producerMinerai: findBuildingByRole(config, 'producer_minerai').id,
    producerSilicium: findBuildingByRole(config, 'producer_silicium').id,
    producerHydrogene: findBuildingByRole(config, 'producer_hydrogene').id,
    producerEnergy: findBuildingByRole(config, 'producer_energy').id,
    storageMinerai: findBuildingByRole(config, 'storage_minerai').id,
    storageSilicium: findBuildingByRole(config, 'storage_silicium').id,
    storageHydrogene: findBuildingByRole(config, 'storage_hydrogene').id,
  };

  // Gate de niveau (si un joueur a perdu son niveau requis via config, on gèle)
  const unlockLevel = Number(config.universe.governor_unlock_level) || 8;
  const levels = await db
    .select({ userId: empireProgression.userId, level: empireProgression.level })
    .from(empireProgression);
  const levelByUser = new Map(levels.map((l) => [l.userId, l.level]));
  void buildEmpireLevelConfig; // (capacité non requise ici)

  let attempted = 0;
  let started = 0;
  for (const planet of governed) {
    if (busy.has(planet.id)) continue;
    if (!isGovernorDirective(planet.governor)) continue;
    if ((levelByUser.get(planet.userId) ?? 1) < unlockLevel) continue;

    let rates;
    try {
      rates = await resourceService.getProductionRates(planet.id, planet, undefined, planet.userId);
    } catch {
      continue;
    }

    const { planetBuildings: pbTable } = await import('@exilium/db');
    const pbRows = await db
      .select({ buildingId: pbTable.buildingId, level: pbTable.level })
      .from(pbTable)
      .where(eq(pbTable.planetId, planet.id));
    const buildingLevels: Record<string, number> = {};
    for (const r of pbRows) buildingLevels[r.buildingId] = r.level;

    const fill = (v: unknown, cap: number) => (cap > 0 ? Number(v) / cap : 0);
    const candidates = governorCandidates(planet.governor, {
      levels: buildingLevels,
      energyBalance: rates.energyProduced - rates.energyConsumed,
      storageFill: {
        minerai: fill(planet.minerai, rates.storageMineraiCapacity),
        silicium: fill(planet.silicium, rates.storageSiliciumCapacity),
        hydrogene: fill(planet.hydrogene, rates.storageHydrogeneCapacity),
      },
      roles,
    });
    if (candidates.length === 0) continue;

    attempted++;
    try {
      await buildingService.startUpgrade(planet.userId, planet.id, candidates[0]);
      started++;
    } catch {
      // Coût/prérequis non remplis — on retentera au prochain tick.
    }
  }
  if (started > 0) console.log(`[governor-tick] ${started}/${attempted} constructions lancées`);
  return { attempted, started };
}
