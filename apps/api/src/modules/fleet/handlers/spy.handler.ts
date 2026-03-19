import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { planets, planetShips, planetDefenses, planetBuildings, userResearch, users } from '@ogame-clone/db';
import { calculateSpyReport, calculateDetectionChance } from '@ogame-clone/game-engine';
import type { Database } from '@ogame-clone/db';
import type { MissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult } from '../fleet.types.js';
import { formatDuration } from '../fleet.types.js';

export class SpyHandler implements MissionHandler {
  async validateFleet(input: SendFleetInput, _config: GameConfig, _ctx: MissionHandlerContext): Promise<void> {
    for (const [shipType, count] of Object.entries(input.ships)) {
      if (count > 0 && shipType !== 'espionageProbe') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seules les sondes d\'espionnage peuvent être envoyées en mission espionnage' });
      }
    }
  }

  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const ships = fleetEvent.ships;
    const probeCount = ships.espionageProbe ?? 0;
    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;

    const attackerTech = await this.getEspionageTech(ctx.db, fleetEvent.userId);

    const [targetPlanet] = await ctx.db
      .select()
      .from(planets)
      .where(
        and(
          eq(planets.galaxy, fleetEvent.targetGalaxy),
          eq(planets.system, fleetEvent.targetSystem),
          eq(planets.position, fleetEvent.targetPosition),
        ),
      )
      .limit(1);

    if (!targetPlanet) {
      if (ctx.messageService) {
        await ctx.messageService.createSystemMessage(
          fleetEvent.userId,
          'espionage',
          `Espionnage ${coords}`,
          `Aucune planète trouvée à la position ${coords}.`,
        );
      }
      return { scheduleReturn: true, cargo: { minerai: 0, silicium: 0, hydrogene: 0 } };
    }

    const defenderTech = await this.getEspionageTech(ctx.db, targetPlanet.userId);
    const visibility = calculateSpyReport(probeCount, attackerTech, defenderTech);

    const duration = formatDuration(fleetEvent.arrivalTime.getTime() - fleetEvent.departureTime.getTime());
    let body = `Rapport d'espionnage de ${coords}\nDurée du trajet : ${duration}\n\n`;

    if (visibility.resources) {
      await ctx.resourceService.materializeResources(targetPlanet.id, targetPlanet.userId);
      const [planet] = await ctx.db.select().from(planets).where(eq(planets.id, targetPlanet.id)).limit(1);
      body += `Ressources :\nMinerai : ${Math.floor(Number(planet.minerai))}\nSilicium : ${Math.floor(Number(planet.silicium))}\nHydrogène : ${Math.floor(Number(planet.hydrogene))}\n\n`;
    }

    if (visibility.fleet) {
      const [targetShips] = await ctx.db.select().from(planetShips).where(eq(planetShips.planetId, targetPlanet.id)).limit(1);
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
      const [defs] = await ctx.db.select().from(planetDefenses).where(eq(planetDefenses.planetId, targetPlanet.id)).limit(1);
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
      const bRows = await ctx.db.select({ buildingId: planetBuildings.buildingId, level: planetBuildings.level })
        .from(planetBuildings).where(eq(planetBuildings.planetId, targetPlanet.id));
      body += `Bâtiments :\n`;
      for (const row of bRows) {
        if (row.level > 0) body += `${row.buildingId}: ${row.level}\n`;
      }
      body += '\n';
    }

    if (visibility.research) {
      const [research] = await ctx.db.select().from(userResearch).where(eq(userResearch.userId, targetPlanet.userId)).limit(1);
      if (research) {
        body += `Recherches :\n`;
        const researchCols = ['espionageTech', 'computerTech', 'energyTech', 'combustion', 'impulse', 'hyperspaceDrive', 'weapons', 'shielding', 'armor'] as const;
        for (const col of researchCols) {
          if (research[col] > 0) body += `${col}: ${research[col]}\n`;
        }
      }
    }

    if (ctx.messageService) {
      await ctx.messageService.createSystemMessage(
        fleetEvent.userId,
        'espionage',
        `Rapport d'espionnage ${coords}`,
        body,
      );
    }

    const detectionChance = calculateDetectionChance(probeCount, attackerTech, defenderTech);
    const detected = Math.random() * 100 < detectionChance;

    if (detected) {
      if (ctx.messageService) {
        const [attackerUser] = await ctx.db.select({ username: users.username }).from(users).where(eq(users.id, fleetEvent.userId)).limit(1);
        await ctx.messageService.createSystemMessage(
          targetPlanet.userId,
          'espionage',
          `Activité d'espionnage détectée ${coords}`,
          `${probeCount} sonde(s) d'espionnage provenant de ${attackerUser?.username ?? 'Inconnu'} ont été détectées et détruites.`,
        );
      }
      // Probes destroyed — no return (dispatcher marks completed)
      return { scheduleReturn: false, shipsAfterArrival: {} };
    }

    return { scheduleReturn: true, cargo: { minerai: 0, silicium: 0, hydrogene: 0 } };
  }

  private async getEspionageTech(db: Database, userId: string): Promise<number> {
    const [research] = await db
      .select({ espionageTech: userResearch.espionageTech })
      .from(userResearch)
      .where(eq(userResearch.userId, userId))
      .limit(1);

    return research?.espionageTech ?? 0;
  }
}
