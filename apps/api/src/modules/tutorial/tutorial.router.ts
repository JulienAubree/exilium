import { protectedProcedure, router } from '../../trpc/router.js';
import type { createTutorialService } from './tutorial.service.js';

export function createTutorialRouter(tutorialService: ReturnType<typeof createTutorialService>) {
  return router({
    getCurrent: protectedProcedure
      .query(async ({ ctx }) => {
        return tutorialService.getCurrent(ctx.userId!);
      }),

    completeQuest: protectedProcedure
      .mutation(async ({ ctx }) => {
        return tutorialService.completeCurrentQuest(ctx.userId!);
      }),
  });
}
