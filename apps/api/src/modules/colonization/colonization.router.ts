import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createColonizationService } from './colonization.service.js';

export function createColonizationRouter(colonizationService: ReturnType<typeof createColonizationService>) {
  return router({
    status: protectedProcedure
      .input(z.object({ planetId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        return colonizationService.getStatus(ctx.userId!, input.planetId);
      }),

    governance: protectedProcedure
      .query(async ({ ctx }) => {
        return colonizationService.getGovernanceInfo(ctx.userId!);
      }),

    /** Player-triggered finalization when progress >= 100% */
    complete: protectedProcedure
      .input(z.object({ planetId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return colonizationService.completeFromPlayer(ctx.userId!, input.planetId);
      }),
  });
}
