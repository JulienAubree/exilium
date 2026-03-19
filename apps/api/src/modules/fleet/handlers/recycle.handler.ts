import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { debrisFields } from '@ogame-clone/db';
import type { MissionHandler, SendFleetInput, GameConfig, MissionHandlerContext, FleetEvent, ArrivalResult } from '../fleet.types.js';
import { formatDuration } from '../fleet.types.js';

export class RecycleHandler implements MissionHandler {
  async validateFleet(input: SendFleetInput, _config: GameConfig, _ctx: MissionHandlerContext): Promise<void> {
    for (const [shipType, count] of Object.entries(input.ships)) {
      if (count > 0 && shipType !== 'recycler') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seuls les recycleurs peuvent être envoyés en mission recyclage' });
      }
    }
  }

  async processArrival(fleetEvent: FleetEvent, ctx: MissionHandlerContext): Promise<ArrivalResult> {
    const mineraiCargo = Number(fleetEvent.mineraiCargo);
    const siliciumCargo = Number(fleetEvent.siliciumCargo);
    const hydrogeneCargo = Number(fleetEvent.hydrogeneCargo);

    const [debris] = await ctx.db
      .select()
      .from(debrisFields)
      .where(
        and(
          eq(debrisFields.galaxy, fleetEvent.targetGalaxy),
          eq(debrisFields.system, fleetEvent.targetSystem),
          eq(debrisFields.position, fleetEvent.targetPosition),
        ),
      )
      .limit(1);

    if (!debris || (Number(debris.minerai) <= 0 && Number(debris.silicium) <= 0)) {
      return {
        scheduleReturn: true,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
      };
    }

    const config = await ctx.gameConfigService.getFullConfig();
    const recyclerDef = config.ships['recycler'];
    const recyclerCount = fleetEvent.ships.recycler ?? 0;
    const cargoPerRecycler = recyclerDef?.cargoCapacity ?? 20000;
    const totalCargoCapacityValue = recyclerCount * cargoPerRecycler;

    let remainingCargo = totalCargoCapacityValue;
    const availableMinerai = Number(debris.minerai);
    const availableSilicium = Number(debris.silicium);

    const collectedMinerai = Math.min(availableMinerai, remainingCargo);
    remainingCargo -= collectedMinerai;
    const collectedSilicium = Math.min(availableSilicium, remainingCargo);

    const newMinerai = availableMinerai - collectedMinerai;
    const newSilicium = availableSilicium - collectedSilicium;

    if (newMinerai <= 0 && newSilicium <= 0) {
      await ctx.db.delete(debrisFields).where(eq(debrisFields.id, debris.id));
    } else {
      await ctx.db
        .update(debrisFields)
        .set({
          minerai: String(newMinerai),
          silicium: String(newSilicium),
          updatedAt: new Date(),
        })
        .where(eq(debrisFields.id, debris.id));
    }

    const coords = `[${fleetEvent.targetGalaxy}:${fleetEvent.targetSystem}:${fleetEvent.targetPosition}]`;
    const duration = formatDuration(fleetEvent.arrivalTime.getTime() - fleetEvent.departureTime.getTime());

    if (ctx.messageService) {
      const parts = [`Recyclage effectué en ${coords}\n`];
      parts.push(`Durée du trajet : ${duration}`);
      parts.push(`Débris collectés : ${collectedMinerai} minerai, ${collectedSilicium} silicium`);
      await ctx.messageService.createSystemMessage(
        fleetEvent.userId,
        'mission',
        `Recyclage effectué ${coords}`,
        parts.join('\n'),
      );
    }

    return {
      scheduleReturn: true,
      cargo: {
        minerai: mineraiCargo + collectedMinerai,
        silicium: siliciumCargo + collectedSilicium,
        hydrogene: hydrogeneCargo,
      },
    };
  }
}
