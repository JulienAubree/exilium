import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createPolicyService } from './policy.service.js';

export function createPolicyRouter(service: ReturnType<typeof createPolicyService>) {
  return router({
    /** État courant : catalogue d'axes, postures actives, capacité, cooldowns, effet net. */
    get: protectedProcedure.query(async ({ ctx }) => {
      return service.getState(ctx.userId!);
    }),

    /** Change la posture d'un axe (posture null/'neutre' = retour au neutre). */
    set: protectedProcedure
      .input(
        z.object({
          axis: z.string(),
          posture: z.string().nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return service.setPosture(ctx.userId!, input.axis, input.posture);
      }),
  });
}
