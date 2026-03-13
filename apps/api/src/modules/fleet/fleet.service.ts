import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { planets, planetShips, planetDefenses, fleetEvents, userResearch } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import {
  fleetSpeed,
  travelTime,
  distance,
  fuelConsumption,
  totalCargoCapacity,
  calculateMaxTemp,
  calculateMinTemp,
  calculateDiameter,
  calculateMaxFields,
} from '@ogame-clone/game-engine';
import type { createResourceService } from '../resource/resource.service.js';
import type { createMessageService } from '../message/message.service.js';
import type { Queue } from 'bullmq';

interface SendFleetInput {
  originPlanetId: string;
  targetGalaxy: number;
  targetSystem: number;
  targetPosition: number;
  mission: 'transport' | 'station' | 'spy' | 'attack' | 'colonize';
  ships: Record<string, number>;
  metalCargo?: number;
  crystalCargo?: number;
  deuteriumCargo?: number;
}

export function createFleetService(
  db: Database,
  resourceService: ReturnType<typeof createResourceService>,
  fleetArrivalQueue: Queue,
  fleetReturnQueue: Queue,
  universeSpeed: number,
  messageService?: ReturnType<typeof createMessageService>,
) {
  return {
    async sendFleet(userId: string, input: SendFleetInput) {
      const planet = await this.getOwnedPlanet(userId, input.originPlanetId);

      // Validate ships are available
      const planetShipRow = await this.getOrCreateShips(input.originPlanetId);
      for (const [shipId, count] of Object.entries(input.ships)) {
        if (count <= 0) continue;
        const available = (planetShipRow[shipId as keyof typeof planetShipRow] ?? 0) as number;
        if (available < count) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Pas assez de ${shipId} (disponible: ${available}, demandé: ${count})`,
          });
        }
      }

      // Get research levels for speed calculation
      const driveTechs = await this.getDriveTechs(userId);
      const speed = fleetSpeed(input.ships, driveTechs);
      if (speed === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucun vaisseau sélectionné' });
      }

      const origin = { galaxy: planet.galaxy, system: planet.system, position: planet.position };
      const target = { galaxy: input.targetGalaxy, system: input.targetSystem, position: input.targetPosition };
      const dist = distance(origin, target);
      const duration = travelTime(origin, target, speed, universeSpeed);
      const fuel = fuelConsumption(input.ships, dist, duration);

      // Validate cargo doesn't exceed capacity
      const cargo = totalCargoCapacity(input.ships);
      const metalCargo = input.metalCargo ?? 0;
      const crystalCargo = input.crystalCargo ?? 0;
      const deuteriumCargo = input.deuteriumCargo ?? 0;
      const totalCargo = metalCargo + crystalCargo + deuteriumCargo;
      if (totalCargo > cargo) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Capacité de fret dépassée' });
      }

      // Find target planet (may not exist for colonization)
      const [targetPlanet] = await db
        .select()
        .from(planets)
        .where(
          and(
            eq(planets.galaxy, input.targetGalaxy),
            eq(planets.system, input.targetSystem),
            eq(planets.position, input.targetPosition),
          ),
        )
        .limit(1);

      // Spend resources (cargo + fuel)
      const totalDeutCost = deuteriumCargo + fuel;
      await resourceService.spendResources(input.originPlanetId, userId, {
        metal: metalCargo,
        crystal: crystalCargo,
        deuterium: totalDeutCost,
      });

      // Deduct ships from planet
      const shipUpdates: Record<string, number> = {};
      for (const [shipId, count] of Object.entries(input.ships)) {
        if (count > 0) {
          const current = (planetShipRow[shipId as keyof typeof planetShipRow] ?? 0) as number;
          shipUpdates[shipId] = current - count;
        }
      }
      await db
        .update(planetShips)
        .set(shipUpdates)
        .where(eq(planetShips.planetId, input.originPlanetId));

      // Create fleet event
      const now = new Date();
      const arrivalTime = new Date(now.getTime() + duration * 1000);

      const [event] = await db
        .insert(fleetEvents)
        .values({
          userId,
          originPlanetId: input.originPlanetId,
          targetPlanetId: targetPlanet?.id ?? null,
          targetGalaxy: input.targetGalaxy,
          targetSystem: input.targetSystem,
          targetPosition: input.targetPosition,
          mission: input.mission,
          phase: 'outbound',
          status: 'active',
          departureTime: now,
          arrivalTime,
          metalCargo: String(metalCargo),
          crystalCargo: String(crystalCargo),
          deuteriumCargo: String(deuteriumCargo),
          ships: input.ships,
        })
        .returning();

      // Schedule arrival job
      await fleetArrivalQueue.add(
        'arrive',
        { fleetEventId: event.id },
        { delay: duration * 1000, jobId: `fleet-arrive-${event.id}` },
      );

      return {
        event,
        arrivalTime: arrivalTime.toISOString(),
        travelTime: duration,
        fuelConsumed: fuel,
      };
    },

    async recallFleet(userId: string, fleetEventId: string) {
      const [event] = await db
        .select()
        .from(fleetEvents)
        .where(
          and(
            eq(fleetEvents.id, fleetEventId),
            eq(fleetEvents.userId, userId),
            eq(fleetEvents.status, 'active'),
            eq(fleetEvents.phase, 'outbound'),
          ),
        )
        .limit(1);

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Flotte non trouvée ou non rappelable' });
      }

      const now = new Date();
      const elapsed = now.getTime() - event.departureTime.getTime();
      const returnTime = new Date(now.getTime() + elapsed);

      await fleetArrivalQueue.remove(`fleet-arrive-${event.id}`);

      await db
        .update(fleetEvents)
        .set({
          phase: 'return',
          departureTime: now,
          arrivalTime: returnTime,
        })
        .where(eq(fleetEvents.id, event.id));

      await fleetReturnQueue.add(
        'return',
        { fleetEventId: event.id },
        { delay: elapsed, jobId: `fleet-return-${event.id}` },
      );

      return { recalled: true, returnTime: returnTime.toISOString() };
    },

    async listMovements(userId: string) {
      return db
        .select()
        .from(fleetEvents)
        .where(
          and(
            eq(fleetEvents.userId, userId),
            eq(fleetEvents.status, 'active'),
          ),
        );
    },

    async processArrival(fleetEventId: string) {
      const [event] = await db
        .select()
        .from(fleetEvents)
        .where(and(eq(fleetEvents.id, fleetEventId), eq(fleetEvents.status, 'active')))
        .limit(1);

      if (!event) return null;

      const ships = event.ships as Record<string, number>;
      const metalCargo = Number(event.metalCargo);
      const crystalCargo = Number(event.crystalCargo);
      const deuteriumCargo = Number(event.deuteriumCargo);

      if (event.mission === 'transport') {
        if (event.targetPlanetId) {
          const [targetPlanet] = await db
            .select()
            .from(planets)
            .where(eq(planets.id, event.targetPlanetId))
            .limit(1);

          if (targetPlanet) {
            await db
              .update(planets)
              .set({
                metal: String(Number(targetPlanet.metal) + metalCargo),
                crystal: String(Number(targetPlanet.crystal) + crystalCargo),
                deuterium: String(Number(targetPlanet.deuterium) + deuteriumCargo),
              })
              .where(eq(planets.id, event.targetPlanetId));
          }
        }

        await this.scheduleReturn(event.id, event.originPlanetId, {
          galaxy: event.targetGalaxy,
          system: event.targetSystem,
          position: event.targetPosition,
        }, ships, 0, 0, 0);

        return { mission: 'transport', delivered: true };
      }

      if (event.mission === 'station') {
        if (event.targetPlanetId) {
          const [targetPlanet] = await db
            .select()
            .from(planets)
            .where(eq(planets.id, event.targetPlanetId))
            .limit(1);

          if (targetPlanet) {
            await db
              .update(planets)
              .set({
                metal: String(Number(targetPlanet.metal) + metalCargo),
                crystal: String(Number(targetPlanet.crystal) + crystalCargo),
                deuterium: String(Number(targetPlanet.deuterium) + deuteriumCargo),
              })
              .where(eq(planets.id, event.targetPlanetId));

            const targetShips = await this.getOrCreateShips(event.targetPlanetId);
            const shipUpdates: Record<string, number> = {};
            for (const [shipId, count] of Object.entries(ships)) {
              if (count > 0) {
                const current = (targetShips[shipId as keyof typeof targetShips] ?? 0) as number;
                shipUpdates[shipId] = current + count;
              }
            }
            await db
              .update(planetShips)
              .set(shipUpdates)
              .where(eq(planetShips.planetId, event.targetPlanetId));
          }
        }

        await db
          .update(fleetEvents)
          .set({ status: 'completed' })
          .where(eq(fleetEvents.id, event.id));

        return { mission: 'station', stationed: true };
      }

      if (event.mission === 'colonize') {
        return this.processColonize(event, ships, metalCargo, crystalCargo, deuteriumCargo);
      }

      // For other missions (attack, spy) — Phase 5b
      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships, metalCargo, crystalCargo, deuteriumCargo,
      );

      return { mission: event.mission, placeholder: true };
    },

    async processReturn(fleetEventId: string) {
      const [event] = await db
        .select()
        .from(fleetEvents)
        .where(
          and(
            eq(fleetEvents.id, fleetEventId),
            eq(fleetEvents.status, 'active'),
            eq(fleetEvents.phase, 'return'),
          ),
        )
        .limit(1);

      if (!event) return null;

      const ships = event.ships as Record<string, number>;

      const originShips = await this.getOrCreateShips(event.originPlanetId);
      const shipUpdates: Record<string, number> = {};
      for (const [shipId, count] of Object.entries(ships)) {
        if (count > 0) {
          const current = (originShips[shipId as keyof typeof originShips] ?? 0) as number;
          shipUpdates[shipId] = current + count;
        }
      }
      await db
        .update(planetShips)
        .set(shipUpdates)
        .where(eq(planetShips.planetId, event.originPlanetId));

      const metalCargo = Number(event.metalCargo);
      const crystalCargo = Number(event.crystalCargo);
      const deuteriumCargo = Number(event.deuteriumCargo);

      if (metalCargo > 0 || crystalCargo > 0 || deuteriumCargo > 0) {
        const [originPlanet] = await db
          .select()
          .from(planets)
          .where(eq(planets.id, event.originPlanetId))
          .limit(1);

        if (originPlanet) {
          await db
            .update(planets)
            .set({
              metal: String(Number(originPlanet.metal) + metalCargo),
              crystal: String(Number(originPlanet.crystal) + crystalCargo),
              deuterium: String(Number(originPlanet.deuterium) + deuteriumCargo),
            })
            .where(eq(planets.id, event.originPlanetId));
        }
      }

      await db
        .update(fleetEvents)
        .set({ status: 'completed' })
        .where(eq(fleetEvents.id, event.id));

      return { returned: true, ships };
    },

    async scheduleReturn(
      fleetEventId: string,
      originPlanetId: string,
      targetCoords: { galaxy: number; system: number; position: number },
      ships: Record<string, number>,
      metalCargo: number,
      crystalCargo: number,
      deuteriumCargo: number,
    ) {
      const [originPlanet] = await db
        .select()
        .from(planets)
        .where(eq(planets.id, originPlanetId))
        .limit(1);

      if (!originPlanet) return;

      const driveTechs = await this.getDriveTechsByEvent(fleetEventId);
      const speed = fleetSpeed(ships, driveTechs);
      const origin = { galaxy: originPlanet.galaxy, system: originPlanet.system, position: originPlanet.position };
      const duration = travelTime(targetCoords, origin, speed, universeSpeed);

      const now = new Date();
      const returnTime = new Date(now.getTime() + duration * 1000);

      await db
        .update(fleetEvents)
        .set({
          phase: 'return',
          departureTime: now,
          arrivalTime: returnTime,
          metalCargo: String(metalCargo),
          crystalCargo: String(crystalCargo),
          deuteriumCargo: String(deuteriumCargo),
          ships,
        })
        .where(eq(fleetEvents.id, fleetEventId));

      await fleetReturnQueue.add(
        'return',
        { fleetEventId },
        { delay: duration * 1000, jobId: `fleet-return-${fleetEventId}` },
      );
    },

    async processColonize(
      event: typeof fleetEvents.$inferSelect,
      ships: Record<string, number>,
      metalCargo: number,
      crystalCargo: number,
      deuteriumCargo: number,
    ) {
      const coords = `[${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}]`;

      // Check if position is free
      const [existing] = await db
        .select()
        .from(planets)
        .where(
          and(
            eq(planets.galaxy, event.targetGalaxy),
            eq(planets.system, event.targetSystem),
            eq(planets.position, event.targetPosition),
          ),
        )
        .limit(1);

      if (existing) {
        if (messageService) {
          await messageService.createSystemMessage(
            event.userId,
            'colonization',
            `Colonisation échouée ${coords}`,
            `La position ${coords} est déjà occupée. Votre flotte fait demi-tour.`,
          );
        }
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, metalCargo, crystalCargo, deuteriumCargo,
        );
        return { mission: 'colonize', success: false, reason: 'occupied' };
      }

      // Check max planets
      const userPlanets = await db
        .select()
        .from(planets)
        .where(eq(planets.userId, event.userId));

      if (userPlanets.length >= 9) {
        if (messageService) {
          await messageService.createSystemMessage(
            event.userId,
            'colonization',
            `Colonisation échouée ${coords}`,
            `Nombre maximum de planètes atteint (9). Votre flotte fait demi-tour.`,
          );
        }
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, metalCargo, crystalCargo, deuteriumCargo,
        );
        return { mission: 'colonize', success: false, reason: 'max_planets' };
      }

      // Success: create new planet
      const randomOffset = Math.floor(Math.random() * 41) - 20;
      const maxTemp = calculateMaxTemp(event.targetPosition, randomOffset);
      const minTemp = calculateMinTemp(maxTemp);
      const diameter = calculateDiameter(event.targetPosition, Math.random());
      const maxFields = calculateMaxFields(diameter);

      const [newPlanet] = await db
        .insert(planets)
        .values({
          userId: event.userId,
          name: 'Colonie',
          galaxy: event.targetGalaxy,
          system: event.targetSystem,
          position: event.targetPosition,
          planetType: 'planet',
          diameter,
          maxFields,
          minTemp,
          maxTemp,
        })
        .returning();

      // Create associated rows
      await db.insert(planetShips).values({ planetId: newPlanet.id });
      await db.insert(planetDefenses).values({ planetId: newPlanet.id });

      // Colony ship is consumed — remove from fleet
      const remainingShips = { ...ships };
      if (remainingShips.colonyShip) {
        remainingShips.colonyShip = Math.max(0, remainingShips.colonyShip - 1);
      }

      // Mark event completed
      await db
        .update(fleetEvents)
        .set({ status: 'completed' })
        .where(eq(fleetEvents.id, event.id));

      // Return remaining ships (if any) with cargo
      const hasRemainingShips = Object.values(remainingShips).some(v => v > 0);
      if (hasRemainingShips) {
        const driveTechs = await this.getDriveTechs(event.userId);
        const speed = fleetSpeed(remainingShips, driveTechs);
        const [originPlanet] = await db
          .select()
          .from(planets)
          .where(eq(planets.id, event.originPlanetId))
          .limit(1);

        if (originPlanet && speed > 0) {
          const origin = { galaxy: originPlanet.galaxy, system: originPlanet.system, position: originPlanet.position };
          const target = { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition };
          const duration = travelTime(target, origin, speed, universeSpeed);
          const now = new Date();
          const returnTime = new Date(now.getTime() + duration * 1000);

          const [returnEvent] = await db
            .insert(fleetEvents)
            .values({
              userId: event.userId,
              originPlanetId: event.originPlanetId,
              targetPlanetId: newPlanet.id,
              targetGalaxy: event.targetGalaxy,
              targetSystem: event.targetSystem,
              targetPosition: event.targetPosition,
              mission: 'transport',
              phase: 'return',
              status: 'active',
              departureTime: now,
              arrivalTime: returnTime,
              metalCargo: String(metalCargo),
              crystalCargo: String(crystalCargo),
              deuteriumCargo: String(deuteriumCargo),
              ships: remainingShips,
            })
            .returning();

          await fleetReturnQueue.add(
            'return',
            { fleetEventId: returnEvent.id },
            { delay: duration * 1000, jobId: `fleet-return-${returnEvent.id}` },
          );
        }
      }

      if (messageService) {
        await messageService.createSystemMessage(
          event.userId,
          'colonization',
          `Colonisation réussie ${coords}`,
          `Une nouvelle colonie a été fondée sur ${coords}. Diamètre : ${diameter}km, ${maxFields} cases disponibles.`,
        );
      }

      return { mission: 'colonize', success: true, planetId: newPlanet.id };
    },

    async getDriveTechs(userId: string) {
      const [research] = await db
        .select()
        .from(userResearch)
        .where(eq(userResearch.userId, userId))
        .limit(1);

      return {
        combustion: (research?.combustion ?? 0) as number,
        impulse: (research?.impulse ?? 0) as number,
        hyperspaceDrive: (research?.hyperspaceDrive ?? 0) as number,
      };
    },

    async getDriveTechsByEvent(fleetEventId: string) {
      const [event] = await db
        .select()
        .from(fleetEvents)
        .where(eq(fleetEvents.id, fleetEventId))
        .limit(1);

      if (!event) return { combustion: 0, impulse: 0, hyperspaceDrive: 0 };
      return this.getDriveTechs(event.userId);
    },

    async getOrCreateShips(planetId: string) {
      const [existing] = await db.select().from(planetShips).where(eq(planetShips.planetId, planetId)).limit(1);
      if (existing) return existing;
      const [created] = await db.insert(planetShips).values({ planetId }).returning();
      return created;
    },

    async getOwnedPlanet(userId: string, planetId: string) {
      const [planet] = await db
        .select()
        .from(planets)
        .where(and(eq(planets.id, planetId), eq(planets.userId, userId)))
        .limit(1);

      if (!planet) throw new TRPCError({ code: 'NOT_FOUND' });
      return planet;
    },
  };
}
