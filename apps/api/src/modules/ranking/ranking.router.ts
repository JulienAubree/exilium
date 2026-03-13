import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createRankingService } from './ranking.service.js';

export function createRankingRouter(rankingService: ReturnType<typeof createRankingService>) {
  return router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }).optional())
      .query(async ({ input }) => {
        return rankingService.getRankings(input?.page, input?.limit);
      }),

    me: protectedProcedure
      .query(async ({ ctx }) => {
        return rankingService.getPlayerRank(ctx.userId!);
      }),
  });
}
