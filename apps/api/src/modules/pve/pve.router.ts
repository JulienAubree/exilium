import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createPveService } from './pve.service.js';
import type { createAsteroidBeltService } from './asteroid-belt.service.js';

export function createPveRouter(
  pveService: ReturnType<typeof createPveService>,
  asteroidBeltService: ReturnType<typeof createAsteroidBeltService>,
) {
  return router({
    getMissions: protectedProcedure.query(async ({ ctx }) => {
      const missions = await pveService.getMissions(ctx.userId!);
      const centerLevel = await pveService.getMissionCenterLevel(ctx.userId!);
      return { missions, centerLevel };
    }),

    getSystemBelts: protectedProcedure
      .input(z.object({
        galaxy: z.number().int().min(1).max(9),
        system: z.number().int().min(1).max(499),
      }))
      .query(async ({ ctx, input }) => {
        const centerLevel = await pveService.getMissionCenterLevel(ctx.userId!);
        if (centerLevel === 0) return {};
        return asteroidBeltService.getSystemDeposits(input.galaxy, input.system);
      }),
  });
}
