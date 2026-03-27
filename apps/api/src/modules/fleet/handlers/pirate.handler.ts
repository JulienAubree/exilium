import { eq } from 'drizzle-orm';
import { fleetEvents, pveMissions, planets } from '@exilium/db';
import { totalCargoCapacity, computeFleetFP, type UnitCombatStats, type FPConfig } from '@exilium/game-engine';
import type { MissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult } from '../fleet.types.js';
import { buildShipStatsMap, getCombatMultipliers, formatDuration } from '../fleet.types.js';

export class PirateHandler implements MissionHandler {
  async validateFleet(_input: SendFleetInput, _config: GameConfig, _ctx: MissionHandlerContext): Promise<void> {
    // No pirate-specific validation (initiated via PvE system)
  }

  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const ships = fleetEvent.ships;
    const pveMissionId = fleetEvent.pveMissionId;
    const mission = pveMissionId
      ? await ctx.db.select().from(pveMissions).where(eq(pveMissions.id, pveMissionId)).limit(1).then(r => r[0])
      : null;

    if (!mission || !ctx.pveService || !ctx.pirateService) {
      return {
        scheduleReturn: true,
        cargo: { minerai: 0, silicium: 0, hydrogene: 0 },
      };
    }

    const params = mission.parameters as { templateId: string; scaledFleet: Record<string, number>; pirateFP: number };
    const config = await ctx.gameConfigService.getFullConfig();
    const playerMultipliers = await getCombatMultipliers(ctx.db, fleetEvent.userId, config.bonuses);
    const shipStatsMap = buildShipStatsMap(config);
    const preCargoCapacity = totalCargoCapacity(ships, shipStatsMap);
    const missionRewards = mission.rewards as {
      minerai: number; silicium: number; hydrogene: number;
      bonusShips: { shipId: string; count: number; chance: number }[];
    };
    const result = await ctx.pirateService.processPirateArrival(
      ships, playerMultipliers, params.scaledFleet, preCargoCapacity, missionRewards,
    );

    // Re-cap loot to surviving fleet's actual cargo capacity
    if (result.outcome === 'attacker') {
      const survivingCargo = totalCargoCapacity(result.survivingShips, shipStatsMap);
      const totalLoot = result.loot.minerai + result.loot.silicium + result.loot.hydrogene;
      if (totalLoot > survivingCargo) {
        const ratio = survivingCargo / totalLoot;
        result.loot.minerai = Math.floor(result.loot.minerai * ratio);
        result.loot.silicium = Math.floor(result.loot.silicium * ratio);
        result.loot.hydrogene = Math.floor(result.loot.hydrogene * ratio);
      }
    }

    // Update fleet event with combat results
    await ctx.db.update(fleetEvents).set({
      ships: result.survivingShips,
      mineraiCargo: String(result.loot.minerai),
      siliciumCargo: String(result.loot.silicium),
      hydrogeneCargo: String(result.loot.hydrogene),
      metadata: Object.keys(result.bonusShips).length > 0
        ? { bonusShips: result.bonusShips }
        : null,
    }).where(eq(fleetEvents.id, fleetEvent.id));

    // Complete PvE mission at arrival (not return)
    await ctx.pveService.completeMission(mission.id);

    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;
    const duration = formatDuration(fleetEvent.arrivalTime.getTime() - fleetEvent.departureTime.getTime());
    const outcomeText = result.outcome === 'attacker' ? 'Victoire' : 'Défaite';

    let messageId: string | undefined;

    if (ctx.messageService) {
      const parts = [`Mission pirate ${coords} — ${outcomeText}\n`];
      parts.push(`Durée du trajet : ${duration}`);
      if (result.outcome === 'attacker') {
        parts.push(`Butin : ${result.loot.minerai} minerai, ${result.loot.silicium} silicium, ${result.loot.hydrogene} hydrogène`);
        if (Object.keys(result.bonusShips).length > 0) {
          const bonusList = Object.entries(result.bonusShips).map(([id, count]) => `${id}: ${count}`).join(', ');
          parts.push(`Vaisseaux bonus : ${bonusList}`);
        }
      }
      // Ship losses
      const losses: string[] = [];
      for (const [shipId, count] of Object.entries(ships)) {
        const surviving = result.survivingShips[shipId] ?? 0;
        const lost = count - surviving;
        if (lost > 0) losses.push(`${shipId}: ${lost}`);
      }
      if (losses.length > 0) {
        parts.push(`Vaisseaux perdus : ${losses.join(', ')}`);
      }
      const msg = await ctx.messageService.createSystemMessage(
        fleetEvent.userId,
        'mission',
        `Mission pirate ${coords} — ${outcomeText}`,
        parts.join('\n'),
      );
      messageId = msg.id;
    }

    // Create structured combat report
    if (ctx.reportService) {
      // Compute FP
      const shipStats: Record<string, UnitCombatStats> = {};
      for (const [id, ship] of Object.entries(config.ships)) {
        shipStats[id] = { weapons: ship.weapons, shotCount: ship.shotCount ?? 1, shield: ship.shield, hull: ship.hull };
      }
      const fpConfig: FPConfig = {
        shotcountExponent: Number(config.universe.fp_shotcount_exponent) || 1.5,
        divisor: Number(config.universe.fp_divisor) || 100,
      };
      const attackerFP = computeFleetFP(ships, shipStats, fpConfig);
      const defenderFP = params.pirateFP ?? computeFleetFP(params.scaledFleet, shipStats, fpConfig);

      // Compute shots per round
      const combatResult = result.combatResult;
      const shotsPerRound = combatResult.rounds.map((round, i) => {
        const attFleet = i === 0 ? ships : combatResult.rounds[i - 1].attackerShips;
        const defFleet = i === 0 ? params.scaledFleet : combatResult.rounds[i - 1].defenderShips;
        const attShots = Object.entries(attFleet).reduce((sum, [id, count]) => sum + count * (config.ships[id]?.shotCount ?? 1), 0);
        const defShots = Object.entries(defFleet).reduce((sum, [id, count]) => sum + count * (config.ships[id]?.shotCount ?? 1), 0);
        return { attacker: attShots, defender: defShots };
      });

      // Build report result
      const reportResult: Record<string, unknown> = {
        outcome: result.outcome,
        roundCount: combatResult.rounds.length,
        attackerFleet: ships,
        attackerLosses: result.attackerLosses,
        attackerSurvivors: result.survivingShips,
        attackerStats: combatResult.attackerStats,
        defenderFleet: params.scaledFleet,
        defenderDefenses: {},
        defenderLosses: combatResult.defenderLosses,
        defenderSurvivors: (() => {
          const survivors: Record<string, number> = {};
          for (const [type, count] of Object.entries(params.scaledFleet)) {
            const remaining = count - (combatResult.defenderLosses[type] ?? 0);
            if (remaining > 0) survivors[type] = remaining;
          }
          return survivors;
        })(),
        repairedDefenses: {},
        debris: combatResult.debris,
        rounds: combatResult.rounds,
        defenderStats: combatResult.defenderStats,
        attackerFP,
        defenderFP,
        shotsPerRound,
      };

      if (result.outcome === 'attacker') {
        reportResult.pillage = result.loot;
        if (Object.keys(result.bonusShips).length > 0) {
          reportResult.bonusShips = result.bonusShips;
        }
      }

      // Fetch origin planet for report
      const [originPlanet] = await ctx.db.select({
        galaxy: planets.galaxy,
        system: planets.system,
        position: planets.position,
        name: planets.name,
      }).from(planets).where(eq(planets.id, fleetEvent.originPlanetId)).limit(1);

      await ctx.reportService.create({
        userId: fleetEvent.userId,
        fleetEventId: fleetEvent.id,
        pveMissionId: pveMissionId ?? undefined,
        messageId,
        missionType: 'pirate',
        title: `Mission pirate ${coords} — ${outcomeText}`,
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
        fleet: {
          ships,
          totalCargo: preCargoCapacity,
        },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result: reportResult,
      });
    }

    return {
      scheduleReturn: true,
      cargo: {
        minerai: result.loot.minerai,
        silicium: result.loot.silicium,
        hydrogene: result.loot.hydrogene,
      },
      shipsAfterArrival: result.survivingShips,
    };
  }
}
