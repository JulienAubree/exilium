import { eq, asc, desc, and, sql, inArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { planets, planetBuildings, planetShips, planetDefenses, buildQueue, fleetEvents, flagships, planetBiomes } from '@exilium/db';
import type { Database } from '@exilium/db';
import {
  calculateMaxTemp,
  calculateMinTemp,
} from '@exilium/game-engine';
import type { GameConfigService } from '../admin/game-config.service.js';
import { getRandomPlanetImageIndex } from '../../lib/planet-image.util.js';
import { findPlanetTypeByRole } from '../../lib/config-helpers.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createPlanetService(
  db: Database,
  gameConfigService: GameConfigService,
  assetsDir: string,
  resourceService?: {
    materializeResources(planetId: string, userId: string): Promise<any>;
    getProductionRates(planetId: string, planet: any, bonus?: any, userId?: string): Promise<any>;
  },
) {
  return {
    async createHomePlanet(userId: string) {
      const config = await gameConfigService.getFullConfig();
      const homeworldType = findPlanetTypeByRole(config, 'homeworld');
      const universe = config.universe;

      const systems = Number(universe.systems) || 499;
      const spawnRadius = Number(universe.spawn_radius) || 10;

      // Spawn near the most recently created homeworld (cluster new players together)
      const [lastPlanet] = await db
        .select({ galaxy: planets.galaxy, system: planets.system })
        .from(planets)
        .where(eq(planets.planetClassId, homeworldType.id))
        .orderBy(desc(planets.createdAt))
        .limit(1);

      const anchor = lastPlanet ?? { galaxy: 1, system: 5 };
      const galaxy = anchor.galaxy;
      const system = Math.max(1, Math.min(systems, anchor.system + randomInt(-spawnRadius, spawnRadius)));
      const posMin = Number(universe.home_planet_position_min) || 4;
      const posMax = Number(universe.home_planet_position_max) || 12;
      const position = randomInt(posMin, posMax);

      const randomOffset = randomInt(-20, 20);
      const maxTemp = calculateMaxTemp(position, randomOffset);
      const minTemp = calculateMinTemp(maxTemp);
      const diameter = Number(universe.homePlanetDiameter) || 12000;

      const startingMinerai = Number(universe.startingMinerai) || 500;
      const startingSilicium = Number(universe.startingSilicium) || 300;
      const startingHydrogene = Number(universe.startingHydrogene) || 100;

      const [planet] = await db
        .insert(planets)
        .values({
          userId,
          name: 'Homeworld',
          galaxy,
          system,
          position,
          planetType: 'planet',
          planetClassId: homeworldType.id,
          diameter,
          minTemp,
          maxTemp,
          minerai: String(startingMinerai),
          silicium: String(startingSilicium),
          hydrogene: String(startingHydrogene),
          planetImageIndex: getRandomPlanetImageIndex(homeworldType.id, assetsDir),
        })
        .returning();

      // Initialize building levels at 0 for all buildings
      const buildingIds = Object.keys(config.buildings);
      if (buildingIds.length > 0) {
        await db.insert(planetBuildings).values(
          buildingIds.map((buildingId) => ({
            planetId: planet.id,
            buildingId,
            level: 0,
          })),
        );
      }

      await db.insert(planetShips).values({ planetId: planet.id });
      await db.insert(planetDefenses).values({ planetId: planet.id });

      return planet;
    },

    async listPlanets(userId: string) {
      const planetList = await db
        .select()
        .from(planets)
        .where(eq(planets.userId, userId))
        .orderBy(asc(planets.sortOrder), asc(planets.createdAt));

      if (planetList.length === 0) return [];

      const planetIds = planetList.map((p) => p.id);
      const planetBiomeRows = await db
        .select({ planetId: planetBiomes.planetId, biomeId: planetBiomes.biomeId })
        .from(planetBiomes)
        .where(and(inArray(planetBiomes.planetId, planetIds), eq(planetBiomes.active, true)));

      const config = await gameConfigService.getFullConfig();
      const biomeDefsById = new Map(config.biomes.map((b) => [b.id, b]));
      type BiomeRow = { planetId: string; id: string; name: string; description: string; rarity: string; effects: unknown };
      const biomesByPlanet = new Map<string, BiomeRow[]>();
      for (const row of planetBiomeRows) {
        const def = biomeDefsById.get(row.biomeId);
        if (!def) continue;
        const entry: BiomeRow = { planetId: row.planetId, id: def.id, name: def.name, description: def.description, rarity: def.rarity, effects: def.effects };
        const list = biomesByPlanet.get(row.planetId) ?? [];
        list.push(entry);
        biomesByPlanet.set(row.planetId, list);
      }

      return planetList.map((p) => ({
        ...p,
        biomes: (biomesByPlanet.get(p.id) ?? []).map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          rarity: b.rarity,
          effects: b.effects,
        })),
      }));
    },

    async getSummaries(userId: string) {
      const planetRows = await db
        .select({
          id: planets.id,
          name: planets.name,
          galaxy: planets.galaxy,
          system: planets.system,
          position: planets.position,
          status: planets.status,
          minerai: planets.minerai,
          silicium: planets.silicium,
          hydrogene: planets.hydrogene,
        })
        .from(planets)
        .where(and(eq(planets.userId, userId), eq(planets.status, 'active')))
        .orderBy(asc(planets.sortOrder), asc(planets.createdAt));

      if (planetRows.length === 0) return [];

      const planetIds = planetRows.map((p) => p.id);
      const shipRows = await db
        .select()
        .from(planetShips)
        .where(inArray(planetShips.planetId, planetIds));

      const config = await gameConfigService.getFullConfig();
      const transportShipIds = Object.values(config.ships)
        .filter((s) => s.role === 'transport')
        .map((s) => s.id);

      const shipsByPlanet = new Map<string, Record<string, number>>();
      for (const row of shipRows) {
        const { planetId, ...counts } = row as Record<string, unknown> & { planetId: string };
        const numericCounts: Record<string, number> = {};
        for (const [k, v] of Object.entries(counts)) {
          if (typeof v === 'number') numericCounts[k] = v;
        }
        shipsByPlanet.set(planetId, numericCounts);
      }

      return planetRows.map((p) => {
        const ships = shipsByPlanet.get(p.id) ?? {};
        const cargoShips: Record<string, number> = {};
        let cargoCapacity = 0;
        for (const shipId of transportShipIds) {
          const count = ships[shipId] ?? 0;
          if (count > 0) {
            cargoShips[shipId] = count;
            cargoCapacity += count * (config.ships[shipId]?.cargoCapacity ?? 0);
          }
        }
        return {
          id: p.id,
          name: p.name,
          galaxy: p.galaxy,
          system: p.system,
          position: p.position,
          minerai: Math.floor(Number(p.minerai)),
          silicium: Math.floor(Number(p.silicium)),
          hydrogene: Math.floor(Number(p.hydrogene)),
          ships: cargoShips,
          cargoCapacity,
        };
      });
    },

    async getPlanet(userId: string, planetId: string) {
      const [planet] = await db
        .select()
        .from(planets)
        .where(eq(planets.id, planetId))
        .limit(1);

      if (!planet || planet.userId !== userId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return planet;
    },

    async rename(userId: string, planetId: string, name: string) {
      const planet = await this.getPlanet(userId, planetId);
      if (!planet) throw new TRPCError({ code: 'NOT_FOUND' });
      if (planet.renamed) throw new TRPCError({ code: 'FORBIDDEN', message: 'Planète déjà renommée' });

      await db
        .update(planets)
        .set({ name, renamed: true })
        .where(eq(planets.id, planetId));

      return { ok: true };
    },

    async reorderPlanets(userId: string, order: { planetId: string; sortOrder: number }[]) {
      const planetIds = order.map((o) => o.planetId);

      // Validate all planets belong to the user
      const userPlanets = await db
        .select({ id: planets.id })
        .from(planets)
        .where(and(eq(planets.userId, userId), inArray(planets.id, planetIds)));

      if (userPlanets.length !== planetIds.length) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Some planets do not belong to user' });
      }

      await db.transaction(async (tx) => {
        for (const { planetId, sortOrder } of order) {
          await tx
            .update(planets)
            .set({ sortOrder })
            .where(eq(planets.id, planetId));
        }
      });

      return { ok: true };
    },

    async getEmpireOverview(userId: string) {
      const planetList = await this.listPlanets(userId);

      if (!resourceService) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'resourceService required for empire' });
      }

      // Get flagship location
      const [flagship] = await db
        .select({ planetId: flagships.planetId })
        .from(flagships)
        .where(eq(flagships.userId, userId))
        .limit(1);
      const flagshipPlanetId = flagship?.planetId ?? null;

      const activePlanetIds = planetList
        .filter((p) => p.status !== 'colonizing')
        .map((p) => p.id);
      const activePlanetClassIds = Array.from(
        new Set(
          planetList
            .filter((p) => p.status !== 'colonizing' && p.planetClassId)
            .map((p) => p.planetClassId!),
        ),
      );

      // Batch all per-planet lookups in parallel — one query per table instead
      // of N×5. Empty activePlanetIds short-circuits to skip querying entirely.
      // biomeRows and planetTypeRows are enriched from the cached game config
      // (config.biomes / config.planetTypes) instead of re-querying those tables.
      const [planetBiomeRows, buildRows, outboundRows, inboundFriendlyRows, inboundAttackRows] =
        activePlanetIds.length === 0
          ? [[], [], [], [], []]
          : await Promise.all([
              db
                .select({ planetId: planetBiomes.planetId, biomeId: planetBiomes.biomeId })
                .from(planetBiomes)
                .where(and(inArray(planetBiomes.planetId, activePlanetIds), eq(planetBiomes.active, true))),
              db
                .select({
                  planetId: buildQueue.planetId,
                  type: buildQueue.type,
                  itemId: buildQueue.itemId,
                  quantity: buildQueue.quantity,
                  endTime: buildQueue.endTime,
                  status: buildQueue.status,
                  facilityId: buildQueue.facilityId,
                })
                .from(buildQueue)
                .where(and(inArray(buildQueue.planetId, activePlanetIds), inArray(buildQueue.status, ['active', 'queued']))),
              db
                .select({
                  planetId: fleetEvents.originPlanetId,
                  count: sql<number>`count(*)::int`,
                  earliestArrival: sql<string>`min(${fleetEvents.arrivalTime})::text`,
                })
                .from(fleetEvents)
                .where(and(
                  inArray(fleetEvents.originPlanetId, activePlanetIds),
                  eq(fleetEvents.userId, userId),
                  eq(fleetEvents.status, 'active'),
                ))
                .groupBy(fleetEvents.originPlanetId),
              db
                .select({
                  planetId: fleetEvents.targetPlanetId,
                  count: sql<number>`count(*)::int`,
                  earliestArrival: sql<string>`min(${fleetEvents.arrivalTime})::text`,
                })
                .from(fleetEvents)
                .where(and(
                  inArray(fleetEvents.targetPlanetId, activePlanetIds),
                  eq(fleetEvents.status, 'active'),
                  sql`(${fleetEvents.userId} = ${userId} OR ${fleetEvents.mission} NOT IN ('attack', 'spy'))`,
                ))
                .groupBy(fleetEvents.targetPlanetId),
              db
                .select({
                  planetId: fleetEvents.targetPlanetId,
                  arrivalTime: sql<string>`min(${fleetEvents.arrivalTime})::text`,
                })
                .from(fleetEvents)
                .where(and(
                  inArray(fleetEvents.targetPlanetId, activePlanetIds),
                  eq(fleetEvents.status, 'active'),
                  inArray(fleetEvents.mission, ['attack', 'spy']),
                  sql`${fleetEvents.userId} != ${userId}`,
                ))
                .groupBy(fleetEvents.targetPlanetId),
            ]);

      const cfg = await gameConfigService.getFullConfig();
      const biomeDefsById = new Map(cfg.biomes.map((b) => [b.id, b]));

      type BiomeEntry = { id: string; name: string; rarity: string; effects: unknown };
      const biomesByPlanet = new Map<string, BiomeEntry[]>();
      for (const row of planetBiomeRows) {
        const def = biomeDefsById.get(row.biomeId);
        if (!def) continue;
        const entry: BiomeEntry = { id: def.id, name: def.name, rarity: def.rarity, effects: def.effects };
        const list = biomesByPlanet.get(row.planetId);
        if (list) list.push(entry);
        else biomesByPlanet.set(row.planetId, [entry]);
      }

      type BuildEntry = typeof buildRows[number];
      const buildsByPlanet = new Map<string, BuildEntry[]>();
      for (const row of buildRows) {
        const list = buildsByPlanet.get(row.planetId);
        if (list) list.push(row);
        else buildsByPlanet.set(row.planetId, [row]);
      }

      const outboundByPlanet = new Map(outboundRows.filter((r) => r.planetId).map((r) => [r.planetId!, r]));
      const inboundFriendlyByPlanet = new Map(inboundFriendlyRows.filter((r) => r.planetId).map((r) => [r.planetId!, r]));
      const inboundAttackByPlanet = new Map(inboundAttackRows.filter((r) => r.planetId).map((r) => [r.planetId!, r]));
      const planetTypeById = new Map(
        cfg.planetTypes
          .filter((t) => activePlanetClassIds.includes(t.id))
          .map((t) => [t.id, { id: t.id, mineraiBonus: t.mineraiBonus, siliciumBonus: t.siliciumBonus, hydrogeneBonus: t.hydrogeneBonus }]),
      );

      const planetData = await Promise.all(
        planetList.map(async (planet) => {
          // Colonizing planets have no buildings/production yet, but may already
          // hold resources delivered by the colony ship cargo or supply convoys.
          // Surface the stored values so the TopBar / Empire card reflect reality.
          if (planet.status === 'colonizing') {
            return {
              id: planet.id,
              name: planet.name,
              galaxy: planet.galaxy,
              system: planet.system,
              position: planet.position,
              planetClassId: planet.planetClassId,
              planetImageIndex: planet.planetImageIndex,
              diameter: planet.diameter,
              minTemp: planet.minTemp,
              maxTemp: planet.maxTemp,
              status: planet.status as string,
              minerai: Number(planet.minerai),
              silicium: Number(planet.silicium),
              hydrogene: Number(planet.hydrogene),
              mineraiPerHour: 0,
              siliciumPerHour: 0,
              hydrogenePerHour: 0,
              storageMineraiCapacity: 0,
              storageSiliciumCapacity: 0,
              storageHydrogeneCapacity: 0,
              energyProduced: 0,
              energyConsumed: 0,
              hasFlagship: false,
              activeBuild: null,
              activeResearch: null,
              activeShipyard: null,
              activeDefense: null,
              outboundFleets: null,
              inboundFriendlyFleets: null,
              inboundAttack: null,
              biomes: [] as BiomeEntry[],
            };
          }

          const updated = await resourceService.materializeResources(planet.id, userId);
          const bonus = planet.planetClassId ? planetTypeById.get(planet.planetClassId) : undefined;
          const rates = await resourceService.getProductionRates(planet.id, planet, bonus, userId);

          const biomes = biomesByPlanet.get(planet.id) ?? [];
          const activeBuilds = buildsByPlanet.get(planet.id) ?? [];
          const findEntry = (type: string) =>
            activeBuilds.find((b) => b.type === type && b.status === 'active')
            ?? activeBuilds.find((b) => b.type === type)
            ?? null;

          const activeBuild = findEntry('building');
          const activeResearch = findEntry('research');
          const activeShipyard = findEntry('ship');
          const activeDefense = findEntry('defense');

          const outbound = outboundByPlanet.get(planet.id);
          const inboundFriendly = inboundFriendlyByPlanet.get(planet.id);
          const inboundAttack = inboundAttackByPlanet.get(planet.id);

          return {
            id: planet.id,
            name: planet.name,
            galaxy: planet.galaxy,
            system: planet.system,
            position: planet.position,
            planetClassId: planet.planetClassId,
            planetImageIndex: planet.planetImageIndex,
            diameter: planet.diameter,
            minTemp: planet.minTemp,
            maxTemp: planet.maxTemp,
            status: planet.status as string,
            minerai: Number(updated.minerai),
            silicium: Number(updated.silicium),
            hydrogene: Number(updated.hydrogene),
            mineraiPerHour: rates.mineraiPerHour,
            siliciumPerHour: rates.siliciumPerHour,
            hydrogenePerHour: rates.hydrogenePerHour,
            storageMineraiCapacity: rates.storageMineraiCapacity,
            storageSiliciumCapacity: rates.storageSiliciumCapacity,
            storageHydrogeneCapacity: rates.storageHydrogeneCapacity,
            energyProduced: rates.energyProduced,
            energyConsumed: rates.energyConsumed,
            hasFlagship: flagshipPlanetId === planet.id,
            activeBuild: activeBuild
              ? { buildingId: activeBuild.itemId, level: activeBuild.quantity, endTime: activeBuild.endTime.toISOString() }
              : null,
            activeResearch: activeResearch
              ? { researchId: activeResearch.itemId, level: activeResearch.quantity, endTime: activeResearch.endTime.toISOString() }
              : null,
            activeShipyard: activeShipyard
              ? { shipId: activeShipyard.itemId, quantity: activeShipyard.quantity, endTime: activeShipyard.endTime.toISOString(), facilityId: activeShipyard.facilityId }
              : null,
            activeDefense: activeDefense
              ? { defenseId: activeDefense.itemId, quantity: activeDefense.quantity, endTime: activeDefense.endTime.toISOString() }
              : null,
            outboundFleets: outbound && outbound.count > 0
              ? { count: outbound.count, earliestArrival: outbound.earliestArrival }
              : null,
            inboundFriendlyFleets: inboundFriendly && inboundFriendly.count > 0
              ? { count: inboundFriendly.count, earliestArrival: inboundFriendly.earliestArrival }
              : null,
            inboundAttack: inboundAttack
              ? { arrivalTime: inboundAttack.arrivalTime }
              : null,
            biomes,
          };
        }),
      );

      const totalRates = {
        mineraiPerHour: planetData.reduce((sum, p) => sum + p.mineraiPerHour, 0),
        siliciumPerHour: planetData.reduce((sum, p) => sum + p.siliciumPerHour, 0),
        hydrogenePerHour: planetData.reduce((sum, p) => sum + p.hydrogenePerHour, 0),
      };

      const [fleetCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(fleetEvents)
        .where(and(eq(fleetEvents.userId, userId), eq(fleetEvents.status, 'active')));

      const inboundAttackCount = planetData.filter(p => p.inboundAttack !== null).length;

      return {
        planets: planetData,
        totalRates,
        activeFleetCount: fleetCount?.count ?? 0,
        inboundAttackCount,
      };
    },
  };
}
