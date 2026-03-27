import { protectedProcedure, router } from '../../trpc/router.js';
import type { createExiliumService } from './exilium.service.js';

export function createExiliumRouter(exiliumService: ReturnType<typeof createExiliumService>) {
  return router({
    getBalance: protectedProcedure
      .query(async ({ ctx }) => {
        return exiliumService.getBalance(ctx.userId!);
      }),

    getLog: protectedProcedure
      .query(async ({ ctx }) => {
        return exiliumService.getLog(ctx.userId!);
      }),
  });
}
