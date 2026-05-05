import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createAnomalyService } from './anomaly.service.js';
import type { createAnomalyBossesService } from '../anomaly-content/anomaly-bosses.service.js';

export function createAnomalyRouter(
  anomalyService: ReturnType<typeof createAnomalyService>,
  anomalyBossesService: ReturnType<typeof createAnomalyBossesService>,
) {
  return router({
    current: protectedProcedure.query(async ({ ctx }) => {
      return anomalyService.current(ctx.userId!);
    }),

    engage: protectedProcedure
      .input(z.object({
        ships: z.record(z.string(), z.number().int().min(0)).optional().default({}),
        tier: z.number().int().min(1).max(1000).default(1),  // V5-Tiers
      }))
      .mutation(async ({ ctx, input }) => {
        return anomalyService.engage(ctx.userId!, { ships: input.ships ?? {}, tier: input.tier });
      }),

    advance: protectedProcedure.mutation(async ({ ctx }) => {
      return anomalyService.advance(ctx.userId!);
    }),

    resolveEvent: protectedProcedure
      .input(z.object({ choiceIndex: z.number().int().min(0).max(4) }))
      .mutation(async ({ ctx, input }) => {
        return anomalyService.resolveEvent(ctx.userId!, input);
      }),

    retreat: protectedProcedure.mutation(async ({ ctx }) => {
      return anomalyService.retreat(ctx.userId!);
    }),

    activateEpic: protectedProcedure
      .input(z.object({ hullId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return anomalyService.activateEpic(ctx.userId!, input.hullId);
      }),

    useRepairCharge: protectedProcedure.mutation(async ({ ctx }) => {
      return anomalyService.useRepairCharge(ctx.userId!);
    }),

    /** V9 Boss — applique le buff choisi par le joueur après une victoire boss. */
    applyBossBuff: protectedProcedure
      .input(z.object({
        buffType: z.enum([
          'damage_boost',
          'hull_repair',
          'shield_amp',
          'armor_amp',
          'extra_charge',
          'module_unlock',
        ]),
      }))
      .mutation(async ({ ctx, input }) => {
        return anomalyService.applyBossBuff(ctx.userId!, input);
      }),

    history: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
      .query(async ({ ctx, input }) => {
        return anomalyService.history(ctx.userId!, input?.limit);
      }),

    leaderboard: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional())
      .query(async ({ input }) => {
        return anomalyService.getLeaderboard(input?.limit ?? 50);
      }),

    /** V9 Boss — pool complète des boss (lecture seule). Utilisée par
     *  le front pour résoudre id → nom/skills/buffs au moment de l'affichage
     *  du preview boss et du modal de récompense.
     *
     *  V9.2 — La pool provient désormais de anomaly_content.bosses (admin
     *  éditable) avec fallback sur le seed in-memory. Async pour aller hit
     *  le content service. */
    bossesPool: protectedProcedure.query(async () => {
      return { bosses: await anomalyBossesService.getPool() };
    }),
  });
}
