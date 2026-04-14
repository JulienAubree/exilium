import { eq, and, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { planets, colonizationEvents, colonizationProcesses } from '@exilium/db';
import { totalCargoCapacity } from '@exilium/game-engine';
import type { MissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult } from '../fleet.types.js';
import { buildShipStatsMap } from '../fleet.types.js';

export class ColonizeReinforceHandler implements MissionHandler {
  async validateFleet(input: SendFleetInput, _config: GameConfig, ctx: MissionHandlerContext): Promise<void> {
    const config = await ctx.gameConfigService.getFullConfig();

    // Must include at least one combat ship (weapons > 0)
    const hasCombatShip = Object.entries(input.ships).some(([shipId, count]) => {
      if (count <= 0) return false;
      const def = config.ships[shipId];
      return def && (def.weapons ?? 0) > 0;
    });

    if (!hasCombatShip) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Au moins un vaisseau de combat est requis pour securiser le secteur' });
    }

    const [target] = await ctx.db
      .select({ id: planets.id })
      .from(planets)
      .where(and(
        eq(planets.galaxy, input.targetGalaxy),
        eq(planets.system, input.targetSystem),
        eq(planets.position, input.targetPosition),
        eq(planets.userId, input.userId!),
        eq(planets.status, 'colonizing'),
      ))
      .limit(1);

    if (!target) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucune colonisation en cours a cette position' });
    }

    // Check reinforce hasn't already been completed
    if (ctx.colonizationService) {
      const process = await ctx.colonizationService.getProcess(target.id);
      if (process?.reinforceCompleted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Le secteur a deja ete securise pour cette colonie' });
      }
    }
  }

  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const config = await ctx.gameConfigService.getFullConfig();

    // Passive bonus: +2%/h per combat ship, capped at 20%/h total
    const boostPerShip = Number(config.universe.colonization_reinforce_boost_per_ship) || 0.02;
    const maxBoost = Number(config.universe.colonization_reinforce_max_boost) || 0.20;

    // Count combat ships (weapons > 0)
    const ships = fleetEvent.ships as Record<string, number>;
    let combatShipCount = 0;
    for (const [shipId, count] of Object.entries(ships)) {
      if (count <= 0) continue;
      const def = config.ships[shipId];
      if (def && (def.weapons ?? 0) > 0) {
        combatShipCount += count;
      }
    }
    const addedBonus = combatShipCount * boostPerShip;

    // Find the colonizing planet
    const [targetPlanet] = await ctx.db
      .select({ id: planets.id })
      .from(planets)
      .where(and(
        eq(planets.galaxy, fleetEvent.targetGalaxy),
        eq(planets.system, fleetEvent.targetSystem),
        eq(planets.position, fleetEvent.targetPosition),
        eq(planets.status, 'colonizing'),
      ))
      .limit(1);

    let actualBonusAdded = 0;

    if (targetPlanet && ctx.colonizationService && addedBonus > 0) {
      const process = await ctx.colonizationService.getProcess(targetPlanet.id);
      if (process && !process.reinforceCompleted) {
        const currentBonus = process.reinforcePassiveBonus ?? 0;
        const newBonus = Math.min(maxBoost, currentBonus + addedBonus);
        actualBonusAdded = newBonus - currentBonus;

        await ctx.db
          .update(colonizationProcesses)
          .set({ reinforcePassiveBonus: newBonus, reinforceCompleted: true })
          .where(eq(colonizationProcesses.id, process.id));

        // Auto-resolve any pending 'raid' event
        const [raidEvent] = await ctx.db
          .select({ id: colonizationEvents.id })
          .from(colonizationEvents)
          .where(and(
            eq(colonizationEvents.processId, process.id),
            eq(colonizationEvents.status, 'pending'),
            eq(colonizationEvents.eventType, 'raid'),
          ))
          .limit(1);

        if (raidEvent) {
          await ctx.colonizationService.resolveEvent(raidEvent.id, fleetEvent.userId);
        }
      }
    }

    // Create mission report
    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;
    let reportId: string | undefined;
    if (ctx.reportService) {
      const shipStatsMap = buildShipStatsMap(config);
      const [originPlanet] = await ctx.db.select({
        galaxy: planets.galaxy, system: planets.system, position: planets.position, name: planets.name,
      }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);

      const report = await ctx.reportService.create({
        userId: fleetEvent.userId,
        fleetEventId: fleetEvent.id,
        missionType: 'colonize_reinforce',
        title: `Securisation du secteur ${coords}`,
        coordinates: {
          galaxy: fleetEvent.targetGalaxy,
          system: fleetEvent.targetSystem,
          position: fleetEvent.targetPosition,
        },
        originCoordinates: originPlanet ? {
          galaxy: originPlanet.galaxy,
          system: originPlanet.system,
          position: originPlanet.position,
          planetName: originPlanet.name,
        } : undefined,
        fleet: { ships: fleetEvent.ships, totalCargo: totalCargoCapacity(ships, shipStatsMap) },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result: {
          combatShipsSent: combatShipCount,
          passiveBonusAdded: Math.round(actualBonusAdded * 100),
          raidResolved: false, // Will be true if a raid was auto-resolved
        },
      });
      reportId = report.id;
    }

    return { scheduleReturn: true, cargo: { minerai: 0, silicium: 0, hydrogene: 0 }, reportId };
  }
}
