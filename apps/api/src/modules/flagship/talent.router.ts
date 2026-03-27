import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createTalentService } from './talent.service.js';

export function createTalentRouter(
  talentService: ReturnType<typeof createTalentService>,
) {
  return router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return talentService.list(ctx.userId!);
      }),

    invest: protectedProcedure
      .input(z.object({ talentId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        return talentService.invest(ctx.userId!, input.talentId);
      }),

    respec: protectedProcedure
      .input(z.object({ talentId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        return talentService.respec(ctx.userId!, input.talentId);
      }),

    resetAll: protectedProcedure
      .mutation(async ({ ctx }) => {
        return talentService.resetAll(ctx.userId!);
      }),

    activate: protectedProcedure
      .input(z.object({ talentId: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        return talentService.activate(ctx.userId!, input.talentId);
      }),
  });
}
