import { eq, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { planets, planetShips, planetDefenses, fleetEvents, userResearch, debrisFields, users } from '@ogame-clone/db';
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
  calculateSpyReport,
  calculateDetectionChance,
  simulateCombat,
  SHIP_STATS,
  type CombatTechs,
} from '@ogame-clone/game-engine';
import type { createResourceService } from '../resource/resource.service.js';
import type { createMessageService } from '../message/message.service.js';
import type { Queue } from 'bullmq';

interface SendFleetInput {
  originPlanetId: string;
  targetGalaxy: number;
  targetSystem: number;
  targetPosition: number;
  mission: 'transport' | 'station' | 'spy' | 'attack' | 'colonize' | 'recycle';
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

      // Validate: cannot attack own planet
      if (input.mission === 'attack') {
        const [targetCheck] = await db
          .select({ userId: planets.userId })
          .from(planets)
          .where(
            and(
              eq(planets.galaxy, input.targetGalaxy),
              eq(planets.system, input.targetSystem),
              eq(planets.position, input.targetPosition),
            ),
          )
          .limit(1);
        if (targetCheck && targetCheck.userId === userId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous ne pouvez pas attaquer votre propre planète' });
        }
      }

      // Validate: recycle mission requires only recyclers
      if (input.mission === 'recycle') {
        for (const [shipType, count] of Object.entries(input.ships)) {
          if (count > 0 && shipType !== 'recycler') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seuls les recycleurs peuvent être envoyés en mission recyclage' });
          }
        }
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

      if (event.mission === 'spy') {
        return this.processSpy(event, ships);
      }

      if (event.mission === 'attack') {
        return this.processAttack(event, ships, metalCargo, crystalCargo, deuteriumCargo);
      }

      if (event.mission === 'recycle') {
        return this.processRecycle(event, ships, metalCargo, crystalCargo, deuteriumCargo);
      }

      // Unknown mission — return fleet
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

    async getCombatTechs(userId: string): Promise<CombatTechs> {
      const [research] = await db
        .select({
          weapons: userResearch.weapons,
          shielding: userResearch.shielding,
          armor: userResearch.armor,
        })
        .from(userResearch)
        .where(eq(userResearch.userId, userId))
        .limit(1);

      return {
        weapons: research?.weapons ?? 0,
        shielding: research?.shielding ?? 0,
        armor: research?.armor ?? 0,
      };
    },

    async getEspionageTech(userId: string): Promise<number> {
      const [research] = await db
        .select({ espionageTech: userResearch.espionageTech })
        .from(userResearch)
        .where(eq(userResearch.userId, userId))
        .limit(1);

      return research?.espionageTech ?? 0;
    },

    async processSpy(
      event: typeof fleetEvents.$inferSelect,
      ships: Record<string, number>,
    ) {
      const probeCount = ships.espionageProbe ?? 0;
      const coords = `[${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}]`;

      const attackerTech = await this.getEspionageTech(event.userId);

      const [targetPlanet] = await db
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

      if (!targetPlanet) {
        if (messageService) {
          await messageService.createSystemMessage(
            event.userId,
            'espionage',
            `Espionnage ${coords}`,
            `Aucune planète trouvée à la position ${coords}.`,
          );
        }
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, 0, 0, 0,
        );
        return { mission: 'spy', success: false, reason: 'no_planet' };
      }

      const defenderTech = await this.getEspionageTech(targetPlanet.userId);
      const visibility = calculateSpyReport(probeCount, attackerTech, defenderTech);

      let body = `Rapport d'espionnage de ${coords}\n\n`;

      if (visibility.resources) {
        await resourceService.materializeResources(targetPlanet.id, targetPlanet.userId);
        const [planet] = await db.select().from(planets).where(eq(planets.id, targetPlanet.id)).limit(1);
        body += `Ressources :\nMétal : ${Math.floor(Number(planet.metal))}\nCristal : ${Math.floor(Number(planet.crystal))}\nDeutérium : ${Math.floor(Number(planet.deuterium))}\n\n`;
      }

      if (visibility.fleet) {
        const [targetShips] = await db.select().from(planetShips).where(eq(planetShips.planetId, targetPlanet.id)).limit(1);
        if (targetShips) {
          body += `Flotte :\n`;
          const shipTypes = ['smallCargo', 'largeCargo', 'lightFighter', 'heavyFighter', 'cruiser', 'battleship', 'espionageProbe', 'colonyShip', 'recycler'] as const;
          for (const t of shipTypes) {
            if (targetShips[t] > 0) body += `${t}: ${targetShips[t]}\n`;
          }
          body += '\n';
        }
      }

      if (visibility.defenses) {
        const [defs] = await db.select().from(planetDefenses).where(eq(planetDefenses.planetId, targetPlanet.id)).limit(1);
        if (defs) {
          body += `Défenses :\n`;
          const defTypes = ['rocketLauncher', 'lightLaser', 'heavyLaser', 'gaussCannon', 'plasmaTurret', 'smallShield', 'largeShield'] as const;
          for (const t of defTypes) {
            if (defs[t] > 0) body += `${t}: ${defs[t]}\n`;
          }
          body += '\n';
        }
      }

      if (visibility.buildings) {
        const [planet] = await db.select().from(planets).where(eq(planets.id, targetPlanet.id)).limit(1);
        body += `Bâtiments :\n`;
        const buildingCols = ['metalMineLevel', 'crystalMineLevel', 'deutSynthLevel', 'solarPlantLevel', 'roboticsLevel', 'shipyardLevel', 'researchLabLevel'] as const;
        for (const col of buildingCols) {
          if (planet[col] > 0) body += `${col}: ${planet[col]}\n`;
        }
        body += '\n';
      }

      if (visibility.research) {
        const [research] = await db.select().from(userResearch).where(eq(userResearch.userId, targetPlanet.userId)).limit(1);
        if (research) {
          body += `Recherches :\n`;
          const researchCols = ['espionageTech', 'computerTech', 'energyTech', 'combustion', 'impulse', 'hyperspaceDrive', 'weapons', 'shielding', 'armor'] as const;
          for (const col of researchCols) {
            if (research[col] > 0) body += `${col}: ${research[col]}\n`;
          }
        }
      }

      if (messageService) {
        await messageService.createSystemMessage(
          event.userId,
          'espionage',
          `Rapport d'espionnage ${coords}`,
          body,
        );
      }

      const detectionChance = calculateDetectionChance(probeCount, attackerTech, defenderTech);
      const detected = Math.random() * 100 < detectionChance;

      if (detected) {
        if (messageService) {
          const [attackerUser] = await db.select({ username: users.username }).from(users).where(eq(users.id, event.userId)).limit(1);
          await messageService.createSystemMessage(
            targetPlanet.userId,
            'espionage',
            `Activité d'espionnage détectée ${coords}`,
            `${probeCount} sonde(s) d'espionnage provenant de ${attackerUser?.username ?? 'Inconnu'} ont été détectées et détruites.`,
          );
        }
        await db
          .update(fleetEvents)
          .set({ status: 'completed' })
          .where(eq(fleetEvents.id, event.id));

        return { mission: 'spy', success: true, detected: true };
      }

      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships, 0, 0, 0,
      );

      return { mission: 'spy', success: true, detected: false };
    },

    async processRecycle(
      event: typeof fleetEvents.$inferSelect,
      ships: Record<string, number>,
      metalCargo: number,
      crystalCargo: number,
      deuteriumCargo: number,
    ) {
      const [debris] = await db
        .select()
        .from(debrisFields)
        .where(
          and(
            eq(debrisFields.galaxy, event.targetGalaxy),
            eq(debrisFields.system, event.targetSystem),
            eq(debrisFields.position, event.targetPosition),
          ),
        )
        .limit(1);

      if (!debris || (Number(debris.metal) <= 0 && Number(debris.crystal) <= 0)) {
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, metalCargo, crystalCargo, deuteriumCargo,
        );
        return { mission: 'recycle', collected: { metal: 0, crystal: 0 } };
      }

      const recyclerCount = ships.recycler ?? 0;
      const cargoPerRecycler = SHIP_STATS.recycler.cargoCapacity;
      const totalCargo = recyclerCount * cargoPerRecycler;

      let remainingCargo = totalCargo;
      const availableMetal = Number(debris.metal);
      const availableCrystal = Number(debris.crystal);

      const collectedMetal = Math.min(availableMetal, remainingCargo);
      remainingCargo -= collectedMetal;
      const collectedCrystal = Math.min(availableCrystal, remainingCargo);

      const newMetal = availableMetal - collectedMetal;
      const newCrystal = availableCrystal - collectedCrystal;

      if (newMetal <= 0 && newCrystal <= 0) {
        await db.delete(debrisFields).where(eq(debrisFields.id, debris.id));
      } else {
        await db
          .update(debrisFields)
          .set({
            metal: String(newMetal),
            crystal: String(newCrystal),
            updatedAt: new Date(),
          })
          .where(eq(debrisFields.id, debris.id));
      }

      await this.scheduleReturn(
        event.id, event.originPlanetId,
        { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
        ships,
        metalCargo + collectedMetal,
        crystalCargo + collectedCrystal,
        deuteriumCargo,
      );

      return { mission: 'recycle', collected: { metal: collectedMetal, crystal: collectedCrystal } };
    },

    async processAttack(
      event: typeof fleetEvents.$inferSelect,
      ships: Record<string, number>,
      metalCargo: number,
      crystalCargo: number,
      deuteriumCargo: number,
    ) {
      const coords = `[${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}]`;

      const [targetPlanet] = await db
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

      if (!targetPlanet) {
        if (messageService) {
          await messageService.createSystemMessage(
            event.userId,
            'combat',
            `Attaque ${coords}`,
            `Aucune planète trouvée à la position ${coords}. Votre flotte fait demi-tour.`,
          );
        }
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          ships, metalCargo, crystalCargo, deuteriumCargo,
        );
        return { mission: 'attack', success: false, reason: 'no_planet' };
      }

      const [defShips] = await db.select().from(planetShips).where(eq(planetShips.planetId, targetPlanet.id)).limit(1);
      const [defDefs] = await db.select().from(planetDefenses).where(eq(planetDefenses.planetId, targetPlanet.id)).limit(1);

      const defenderFleet: Record<string, number> = {};
      const defenderDefenses: Record<string, number> = {};
      const shipTypes = ['smallCargo', 'largeCargo', 'lightFighter', 'heavyFighter', 'cruiser', 'battleship', 'espionageProbe', 'colonyShip', 'recycler'] as const;
      const defenseTypes = ['rocketLauncher', 'lightLaser', 'heavyLaser', 'gaussCannon', 'plasmaTurret', 'smallShield', 'largeShield'] as const;

      if (defShips) {
        for (const t of shipTypes) {
          if (defShips[t] > 0) defenderFleet[t] = defShips[t];
        }
      }
      if (defDefs) {
        for (const t of defenseTypes) {
          if (defDefs[t] > 0) defenderDefenses[t] = defDefs[t];
        }
      }

      const attackerTechs = await this.getCombatTechs(event.userId);
      const defenderTechs = await this.getCombatTechs(targetPlanet.userId);

      const hasDefenders = Object.values(defenderFleet).some(v => v > 0) ||
                           Object.values(defenderDefenses).some(v => v > 0);

      // Merge defender fleet + defenses into one pool for simulateCombat
      const defenderCombined: Record<string, number> = { ...defenderFleet, ...defenderDefenses };

      let outcome: 'attacker' | 'defender' | 'draw';
      let attackerLosses: Record<string, number> = {};
      let defenderLosses: Record<string, number> = {};
      let debris = { metal: 0, crystal: 0 };
      let repairedDefenses: Record<string, number> = {};
      let roundCount = 0;

      if (!hasDefenders) {
        outcome = 'attacker';
      } else {
        const result = simulateCombat(ships, defenderCombined, attackerTechs, defenderTechs);
        outcome = result.outcome;
        attackerLosses = result.attackerLosses;
        defenderLosses = result.defenderLosses;
        debris = result.debris;
        repairedDefenses = result.repairedDefenses;
        roundCount = result.rounds.length;
      }

      // Apply attacker losses
      const survivingShips: Record<string, number> = { ...ships };
      for (const [type, lost] of Object.entries(attackerLosses)) {
        survivingShips[type] = (survivingShips[type] ?? 0) - (lost as number);
        if (survivingShips[type] <= 0) delete survivingShips[type];
      }

      // Apply defender ship losses
      if (defShips) {
        const shipUpdates: Record<string, number> = {};
        for (const t of shipTypes) {
          const lost = defenderLosses[t] ?? 0;
          if (lost > 0) shipUpdates[t] = defShips[t] - lost;
        }
        if (Object.keys(shipUpdates).length > 0) {
          await db.update(planetShips).set(shipUpdates).where(eq(planetShips.planetId, targetPlanet.id));
        }
      }

      // Apply defender defense losses (minus repairs)
      if (defDefs) {
        const defUpdates: Record<string, number> = {};
        for (const t of defenseTypes) {
          const lost = defenderLosses[t] ?? 0;
          const repaired = repairedDefenses[t] ?? 0;
          const netLoss = lost - repaired;
          if (netLoss > 0) defUpdates[t] = defDefs[t] - netLoss;
        }
        if (Object.keys(defUpdates).length > 0) {
          await db.update(planetDefenses).set(defUpdates).where(eq(planetDefenses.planetId, targetPlanet.id));
        }
      }

      // Create/accumulate debris field
      if (debris.metal > 0 || debris.crystal > 0) {
        const [existing] = await db
          .select()
          .from(debrisFields)
          .where(
            and(
              eq(debrisFields.galaxy, event.targetGalaxy),
              eq(debrisFields.system, event.targetSystem),
              eq(debrisFields.position, event.targetPosition),
            ),
          )
          .limit(1);

        if (existing) {
          await db
            .update(debrisFields)
            .set({
              metal: String(Number(existing.metal) + debris.metal),
              crystal: String(Number(existing.crystal) + debris.crystal),
              updatedAt: new Date(),
            })
            .where(eq(debrisFields.id, existing.id));
        } else {
          await db.insert(debrisFields).values({
            galaxy: event.targetGalaxy,
            system: event.targetSystem,
            position: event.targetPosition,
            metal: String(debris.metal),
            crystal: String(debris.crystal),
          });
        }
      }

      // Pillage resources if attacker wins
      let pillagedMetal = 0;
      let pillagedCrystal = 0;
      let pillagedDeuterium = 0;

      if (outcome === 'attacker') {
        const remainingCargoCapacity = totalCargoCapacity(survivingShips);
        const availableCargo = remainingCargoCapacity - metalCargo - crystalCargo - deuteriumCargo;

        if (availableCargo > 0) {
          await resourceService.materializeResources(targetPlanet.id, targetPlanet.userId);
          const [updatedPlanet] = await db.select().from(planets).where(eq(planets.id, targetPlanet.id)).limit(1);

          const availMetal = Math.floor(Number(updatedPlanet.metal));
          const availCrystal = Math.floor(Number(updatedPlanet.crystal));
          const availDeut = Math.floor(Number(updatedPlanet.deuterium));

          const thirdCargo = Math.floor(availableCargo / 3);

          pillagedMetal = Math.min(availMetal, thirdCargo);
          pillagedCrystal = Math.min(availCrystal, thirdCargo);
          pillagedDeuterium = Math.min(availDeut, thirdCargo);

          let remaining = availableCargo - pillagedMetal - pillagedCrystal - pillagedDeuterium;

          if (remaining > 0) {
            const extraMetal = Math.min(availMetal - pillagedMetal, remaining);
            pillagedMetal += extraMetal;
            remaining -= extraMetal;
          }
          if (remaining > 0) {
            const extraCrystal = Math.min(availCrystal - pillagedCrystal, remaining);
            pillagedCrystal += extraCrystal;
            remaining -= extraCrystal;
          }
          if (remaining > 0) {
            const extraDeut = Math.min(availDeut - pillagedDeuterium, remaining);
            pillagedDeuterium += extraDeut;
          }

          await db
            .update(planets)
            .set({
              metal: sql`${planets.metal} - ${pillagedMetal}`,
              crystal: sql`${planets.crystal} - ${pillagedCrystal}`,
              deuterium: sql`${planets.deuterium} - ${pillagedDeuterium}`,
            })
            .where(eq(planets.id, targetPlanet.id));
        }
      }

      // Send combat reports
      const outcomeText = outcome === 'attacker' ? 'Victoire' :
                          outcome === 'defender' ? 'Défaite' : 'Match nul';

      const reportBody = `Combat ${coords} — ${outcomeText}\n\n` +
        `Rounds : ${roundCount}\n` +
        `Pertes attaquant : ${JSON.stringify(attackerLosses)}\n` +
        `Pertes défenseur : ${JSON.stringify(defenderLosses)}\n` +
        `Défenses réparées : ${JSON.stringify(repairedDefenses)}\n` +
        `Débris : ${debris.metal} métal, ${debris.crystal} cristal\n` +
        (outcome === 'attacker' ?
          `Pillage : ${pillagedMetal} métal, ${pillagedCrystal} cristal, ${pillagedDeuterium} deutérium\n` : '');

      if (messageService) {
        await messageService.createSystemMessage(
          event.userId,
          'combat',
          `Rapport de combat ${coords} — ${outcomeText}`,
          reportBody,
        );
        await messageService.createSystemMessage(
          targetPlanet.userId,
          'combat',
          `Rapport de combat ${coords} — ${outcome === 'attacker' ? 'Défaite' : outcome === 'defender' ? 'Victoire' : 'Match nul'}`,
          reportBody,
        );
      }

      // Return surviving fleet with cargo + pillage
      const hasShips = Object.values(survivingShips).some(v => v > 0);
      if (hasShips) {
        await this.scheduleReturn(
          event.id, event.originPlanetId,
          { galaxy: event.targetGalaxy, system: event.targetSystem, position: event.targetPosition },
          survivingShips,
          metalCargo + pillagedMetal,
          crystalCargo + pillagedCrystal,
          deuteriumCargo + pillagedDeuterium,
        );
      } else {
        await db
          .update(fleetEvents)
          .set({ status: 'completed' })
          .where(eq(fleetEvents.id, event.id));
      }

      return { mission: 'attack', outcome };
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
