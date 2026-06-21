import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createCombatService } from './combat.service.js';

const unitsSchema = z.record(z.string(), z.number().int().min(0).max(999999));

export function createCombatRouter(service: ReturnType<typeof createCombatService>) {
  return router({
    /** Codex des contres — stats + batteries de chaque unité combat. */
    codex: protectedProcedure.query(async () => {
      return service.codex();
    }),

    /** Simulation bac à sable : ma flotte vs une composition saisie. Read-only. */
    simulate: protectedProcedure
      .input(
        z.object({
          attackerShips: unitsSchema,
          defenderShips: unitsSchema.default({}),
          defenderDefenses: unitsSchema.default({}),
          defenderShieldLevel: z.number().int().min(0).max(30).default(0),
          defenderTechLevel: z.number().int().min(0).max(50).default(0),
          runs: z.number().int().min(1).max(500).default(200),
        }),
      )
      .query(async ({ ctx, input }) => {
        return service.simulate(ctx.userId!, input);
      }),
  });
}
