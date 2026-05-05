import { protectedProcedure, router } from '../../trpc/router.js';
import type { createAdminProcedure } from '../../trpc/router.js';
import type { createAnomalyContentService } from './anomaly-content.service.js';
import type { createAnomalyBossesService } from './anomaly-bosses.service.js';
import { anomalyContentSchema } from './anomaly-content.types.js';

export function createAnomalyContentRouter(
  service: ReturnType<typeof createAnomalyContentService>,
  adminProcedure: ReturnType<typeof createAdminProcedure>,
  /** V9.2 — bosses service injecté pour invalider son cache après update admin. */
  anomalyBossesService?: ReturnType<typeof createAnomalyBossesService>,
) {
  const adminRouter = router({
    update: adminProcedure
      .input(anomalyContentSchema)
      .mutation(async ({ input }) => {
        const result = await service.updateContent(input);
        // V9.2 — invalide le cache bosses pour que la prochaine fight pickBossForDepth
        // voie les modifs admin sans attendre TTL.
        anomalyBossesService?.invalidateCache();
        return result;
      }),

    reset: adminProcedure.mutation(async () => {
      const result = await service.resetContent();
      anomalyBossesService?.invalidateCache();
      return result;
    }),
  });

  return router({
    /** Authenticated read — anomaly content is read by the in-game UI. */
    get: protectedProcedure.query(() => service.getContent()),
    admin: adminRouter,
  });
}
