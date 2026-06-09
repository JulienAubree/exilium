import { protectedProcedure, router } from '../../trpc/router.js';
import type { createEmpireProgressionService } from './empire-progression.service.js';

export function createEmpireProgressionRouter(
  empireProgressionService: ReturnType<typeof createEmpireProgressionService>,
) {
  return router({
    get: protectedProcedure
      .query(async ({ ctx }) => {
        return empireProgressionService.getProgression(ctx.userId!);
      }),
  });
}
