import { eq } from 'drizzle-orm';
import { planets } from '@ogame-clone/db';
import type { MissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult } from '../fleet.types.js';

export class TransportHandler implements MissionHandler {
  async validateFleet(_input: SendFleetInput, _config: GameConfig, _ctx: MissionHandlerContext): Promise<void> {
    // No transport-specific validation
  }

  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const mineraiCargo = Number(fleetEvent.mineraiCargo);
    const siliciumCargo = Number(fleetEvent.siliciumCargo);
    const hydrogeneCargo = Number(fleetEvent.hydrogeneCargo);

    if (fleetEvent.targetPlanetId) {
      const [targetPlanet] = await ctx.db
        .select()
        .from(planets)
        .where(eq(planets.id, fleetEvent.targetPlanetId))
        .limit(1);

      if (targetPlanet) {
        await ctx.db
          .update(planets)
          .set({
            minerai: String(Number(targetPlanet.minerai) + mineraiCargo),
            silicium: String(Number(targetPlanet.silicium) + siliciumCargo),
            hydrogene: String(Number(targetPlanet.hydrogene) + hydrogeneCargo),
          })
          .where(eq(planets.id, fleetEvent.targetPlanetId));
      }
    }

    return {
      scheduleReturn: true,
      cargo: { minerai: 0, silicium: 0, hydrogene: 0 },
    };
  }
}
