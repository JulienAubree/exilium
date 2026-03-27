import { eq } from 'drizzle-orm';
import { planets } from '@exilium/db';
import type { MissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult } from '../fleet.types.js';
import { formatDuration } from '../fleet.types.js';

export class TransportHandler implements MissionHandler {
  async validateFleet(_input: SendFleetInput, _config: GameConfig, _ctx: MissionHandlerContext): Promise<void> {
    // No transport-specific validation
  }

  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const mineraiCargo = Number(fleetEvent.mineraiCargo);
    const siliciumCargo = Number(fleetEvent.siliciumCargo);
    const hydrogeneCargo = Number(fleetEvent.hydrogeneCargo);
    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;
    const duration = formatDuration(fleetEvent.arrivalTime.getTime() - fleetEvent.departureTime.getTime());

    // Check target planet exists
    const [targetPlanet] = fleetEvent.targetPlanetId
      ? await ctx.db.select().from(planets).where(eq(planets.id, fleetEvent.targetPlanetId)).limit(1)
      : [];

    if (!targetPlanet) {
      if (ctx.messageService) {
        await ctx.messageService.createSystemMessage(
          fleetEvent.userId,
          'mission',
          `Transport echoue ${coords}`,
          `Planete deserte trouvee en ${coords}. Impossible de livrer en zone hostile.\nDuree du trajet : ${duration}\nVotre flotte fait demi-tour avec son cargo.`,
        );
      }
      return {
        scheduleReturn: true,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
      };
    }

    await ctx.db
      .update(planets)
      .set({
        minerai: String(Number(targetPlanet.minerai) + mineraiCargo),
        silicium: String(Number(targetPlanet.silicium) + siliciumCargo),
        hydrogene: String(Number(targetPlanet.hydrogene) + hydrogeneCargo),
      })
      .where(eq(planets.id, targetPlanet.id));

    if (ctx.messageService) {
      const parts = [`Transport effectué vers ${coords}\n`];
      parts.push(`Durée du trajet : ${duration}`);
      if (mineraiCargo > 0 || siliciumCargo > 0 || hydrogeneCargo > 0) {
        parts.push(`Cargo livré : ${mineraiCargo} minerai, ${siliciumCargo} silicium, ${hydrogeneCargo} hydrogène`);
      }
      await ctx.messageService.createSystemMessage(
        fleetEvent.userId,
        'mission',
        `Transport effectué ${coords}`,
        parts.join('\n'),
      );
    }

    return {
      scheduleReturn: true,
      cargo: { minerai: 0, silicium: 0, hydrogene: 0 },
    };
  }
}
