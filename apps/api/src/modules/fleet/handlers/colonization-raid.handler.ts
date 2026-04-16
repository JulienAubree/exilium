import { eq, and, sql } from 'drizzle-orm';
import { planets, planetShips, colonizationProcesses } from '@exilium/db';
import { simulateCombat, totalCargoCapacity } from '@exilium/game-engine';
import type { CombatInput } from '@exilium/game-engine';
import type { MissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult } from '../fleet.types.js';
import { buildShipStatsMap, buildShipCombatConfigs, buildShipCosts } from '../fleet.types.js';
import {
  buildCombatConfig,
  parseUnitRow,
  applyDefenderLosses,
  computeBothFP,
  computeShotsPerRound,
  buildCombatReportData,
} from '../combat.helpers.js';

export class ColonizationRaidHandler implements MissionHandler {
  async validateFleet(): Promise<void> {
    // Auto-generated raids — no player validation needed
  }

  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const config = await ctx.gameConfigService.getFullConfig();
    const basePenalty = Number(config.universe.colonization_raid_base_penalty) || 0.08;
    const noGarrisonPillage = Number(config.universe.colonization_raid_no_garrison_pillage) || 0.50;
    const garrisonPillage = Number(config.universe.colonization_raid_garrison_pillage) || 0.33;

    const shipStatsMap = buildShipStatsMap(config);
    const shipCombatConfigs = buildShipCombatConfigs(config);
    const shipCostsMap = buildShipCosts(config);
    const shipIdSet = new Set(Object.keys(config.ships));
    const defenseIdSet = new Set(Object.keys(config.defenses));
    const combatConfig = buildCombatConfig(config.universe);

    // Find the colonizing planet at target coordinates
    const [targetPlanet] = await ctx.db
      .select()
      .from(planets)
      .where(and(
        eq(planets.galaxy, fleetEvent.targetGalaxy),
        eq(planets.system, fleetEvent.targetSystem),
        eq(planets.position, fleetEvent.targetPosition),
        eq(planets.status, 'colonizing'),
      ))
      .limit(1);

    if (!targetPlanet) {
      // Planet no longer colonizing — raid fizzles
      return { scheduleReturn: false };
    }

    // Get the colonization process
    const process = ctx.colonizationService
      ? await ctx.colonizationService.getProcess(targetPlanet.id)
      : null;

    // Get garrison ships on the planet
    const [garrisonRow] = await ctx.db
      .select()
      .from(planetShips)
      .where(eq(planetShips.planetId, targetPlanet.id))
      .limit(1);

    const garrisonFleet = parseUnitRow(garrisonRow);
    const hasGarrison = Object.values(garrisonFleet).some(v => v > 0);
    const pirateFleet = fleetEvent.ships as Record<string, number>;

    const currentMinerai = Number(targetPlanet.minerai);
    const currentSilicium = Number(targetPlanet.silicium);
    const currentHydrogene = Number(targetPlanet.hydrogene);

    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;

    if (!hasGarrison) {
      // No defense — full penalty + pillage resources
      await ctx.db.update(planets).set({
        minerai: String(Math.floor(currentMinerai * (1 - noGarrisonPillage))),
        silicium: String(Math.floor(currentSilicium * (1 - noGarrisonPillage))),
        hydrogene: String(Math.floor(currentHydrogene * (1 - noGarrisonPillage))),
      }).where(eq(planets.id, targetPlanet.id));

      // Apply full progression penalty
      if (process) {
        await ctx.db
          .update(colonizationProcesses)
          .set({ progress: sql`GREATEST(${colonizationProcesses.progress} - ${basePenalty}, 0)` })
          .where(eq(colonizationProcesses.id, process.id));
      }

      // Update lastRaidAt
      if (process) {
        await ctx.db
          .update(colonizationProcesses)
          .set({ lastRaidAt: new Date() })
          .where(eq(colonizationProcesses.id, process.id));
      }

      // Create raid report for the planet owner
      let reportId: string | undefined;
      if (ctx.reportService) {
        const report = await ctx.reportService.create({
          userId: targetPlanet.userId,
          fleetEventId: fleetEvent.id,
          missionType: 'colonization_raid',
          title: `Raid pirate ${coords} — Sans defense`,
          coordinates: {
            galaxy: fleetEvent.targetGalaxy,
            system: fleetEvent.targetSystem,
            position: fleetEvent.targetPosition,
          },
          fleet: { ships: pirateFleet, totalCargo: 0 },
          departureTime: fleetEvent.departureTime,
          completionTime: fleetEvent.arrivalTime,
          result: {
            outcome: 'attacker',
            hasGarrison: false,
            pirateFleet,
            progressPenalty: basePenalty,
            pillaged: {
              minerai: Math.floor(currentMinerai * noGarrisonPillage),
              silicium: Math.floor(currentSilicium * noGarrisonPillage),
              hydrogene: Math.floor(currentHydrogene * noGarrisonPillage),
            },
          },
        });
        reportId = report.id;
      }

      return { scheduleReturn: false, reportId };
    }

    // Has garrison — run full combat simulation
    const combatInput: CombatInput = {
      attackerFleet: pirateFleet,
      defenderFleet: garrisonFleet,
      defenderDefenses: {},
      attackerMultipliers: { weapons: 1, shielding: 1, armor: 1 },
      defenderMultipliers: { weapons: 1, shielding: 1, armor: 1 },
      attackerTargetPriority: 'light',
      defenderTargetPriority: 'light',
      combatConfig,
      shipConfigs: shipCombatConfigs,
      shipCosts: shipCostsMap,
      shipIds: shipIdSet,
      defenseIds: defenseIdSet,
      planetaryShieldCapacity: 0,
    };

    const result = simulateCombat(combatInput);
    const { outcome, attackerLosses, defenderLosses, repairedDefenses, rounds } = result;

    // Apply garrison losses (ships only, no defenses on colonizing planet)
    await applyDefenderLosses(ctx.db, targetPlanet.id, garrisonRow as Record<string, unknown>, undefined, defenderLosses, repairedDefenses);

    // Calculate progression penalty based on combat outcome
    let progressPenalty = 0;
    let pillagedMinerai = 0;
    let pillagedSilicium = 0;
    let pillagedHydrogene = 0;

    if (outcome === 'attacker') {
      // Pirates won — apply reduced penalty and pillage
      progressPenalty = basePenalty;
      pillagedMinerai = Math.floor(currentMinerai * garrisonPillage);
      pillagedSilicium = Math.floor(currentSilicium * garrisonPillage);
      pillagedHydrogene = Math.floor(currentHydrogene * garrisonPillage);

      await ctx.db.update(planets).set({
        minerai: String(Math.floor(currentMinerai * (1 - garrisonPillage))),
        silicium: String(Math.floor(currentSilicium * (1 - garrisonPillage))),
        hydrogene: String(Math.floor(currentHydrogene * (1 - garrisonPillage))),
      }).where(eq(planets.id, targetPlanet.id));

      if (process) {
        await ctx.db
          .update(colonizationProcesses)
          .set({ progress: sql`GREATEST(${colonizationProcesses.progress} - ${progressPenalty}, 0)` })
          .where(eq(colonizationProcesses.id, process.id));
      }
    } else if (outcome === 'draw') {
      // Draw — reduced penalty, no pillage
      progressPenalty = basePenalty * 0.5;
      if (process) {
        await ctx.db
          .update(colonizationProcesses)
          .set({ progress: sql`GREATEST(${colonizationProcesses.progress} - ${progressPenalty}, 0)` })
          .where(eq(colonizationProcesses.id, process.id));
      }
    }
    // Defender wins — no penalty, no pillage

    // Update lastRaidAt
    if (process) {
      await ctx.db
        .update(colonizationProcesses)
        .set({ lastRaidAt: new Date() })
        .where(eq(colonizationProcesses.id, process.id));
    }

    // Compute FP and shots for report
    const { attackerFP, defenderFP } = computeBothFP(config, pirateFleet, garrisonFleet, {}, shipCombatConfigs);
    const shotsPerRound = computeShotsPerRound(config, pirateFleet, garrisonFleet, {}, rounds);

    // Build combat report
    let reportId: string | undefined;
    if (ctx.reportService) {
      const reportResult = buildCombatReportData({
        outcome,
        attackerUsername: 'Pirates',
        defenderUsername: 'Garnison',
        targetPlanetName: targetPlanet.name,
        attackerFleet: pirateFleet,
        defenderFleet: garrisonFleet,
        defenderDefenses: {},
        attackerLosses,
        defenderLosses,
        attackerSurvivors: computeAttackerSurvivors(pirateFleet, attackerLosses),
        repairedDefenses,
        debris: result.debris,
        rounds,
        attackerStats: result.attackerStats,
        defenderStats: result.defenderStats,
        attackerFP,
        defenderFP,
        shotsPerRound,
      });

      if (outcome === 'attacker') {
        reportResult.pillage = {
          minerai: pillagedMinerai,
          silicium: pillagedSilicium,
          hydrogene: pillagedHydrogene,
        };
      }

      reportResult.progressPenalty = progressPenalty;
      reportResult.raidType = 'colonization_raid';

      const report = await ctx.reportService.create({
        userId: targetPlanet.userId,
        fleetEventId: fleetEvent.id,
        missionType: 'colonization_raid',
        title: `Raid pirate ${coords} — ${outcomeLabel(outcome)}`,
        coordinates: {
          galaxy: fleetEvent.targetGalaxy,
          system: fleetEvent.targetSystem,
          position: fleetEvent.targetPosition,
        },
        fleet: { ships: pirateFleet, totalCargo: 0 },
        departureTime: fleetEvent.departureTime,
        completionTime: fleetEvent.arrivalTime,
        result: reportResult,
      });
      reportId = report.id;
    }

    return { scheduleReturn: false, reportId };
  }
}

// ── Local helpers ──

function computeAttackerSurvivors(
  fleet: Record<string, number>,
  losses: Record<string, number>,
): Record<string, number> {
  const survivors: Record<string, number> = { ...fleet };
  for (const [type, lost] of Object.entries(losses)) {
    survivors[type] = (survivors[type] ?? 0) - lost;
    if (survivors[type] <= 0) delete survivors[type];
  }
  return survivors;
}

function outcomeLabel(outcome: 'attacker' | 'defender' | 'draw'): string {
  if (outcome === 'attacker') return 'Colonie pillee';
  if (outcome === 'defender') return 'Raid repousse';
  return 'Match nul';
}
