import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createExplorationMissionService } from './exploration-mission.service.js';

/**
 * Endpoints joueur pour les Missions d'exploration en espace profond.
 * Auth : protectedProcedure (utilisateur connecté requis).
 *
 * Les actions admin (CRUD du contenu, kill-switch, force-resolve)
 * sont dans `exploration-content.router.ts`.
 */
export function createExplorationMissionRouter(
  service: ReturnType<typeof createExplorationMissionService>,
) {
  return router({
    /** Liste les missions actives (available + engaged + awaiting_decision). */
    list: protectedProcedure.query(async ({ ctx }) => {
      // Refill paresseux à la lecture : s'assure que le pool est plein
      await service.ensureAvailableMissions(ctx.userId!);
      const missions = await service.listForUser(ctx.userId!);
      return { missions };
    }),

    /** Détail d'une mission spécifique. */
    getDetail: protectedProcedure
      .input(z.object({ missionId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const mission = await service.getDetail(ctx.userId!, input.missionId);
        if (!mission) return null;
        return mission;
      }),

    /**
     * Engage une mission `available` avec la flotte spécifiée. Décrément
     * atomique des vaisseaux + hydrogène + snapshot complet.
     */
    engage: protectedProcedure
      .input(z.object({
        missionId: z.string().uuid(),
        planetId: z.string().uuid(),
        ships: z.record(z.string(), z.number().int().min(0)),
      }))
      .mutation(async ({ ctx, input }) => {
        return service.engageMission(
          ctx.userId!,
          input.missionId,
          input.ships,
          input.planetId,
        );
      }),

    /**
     * Résout l'événement en attente avec le choix donné.
     * `resolutionToken` est généré côté client (uuid v4) pour idempotence.
     */
    resolveStep: protectedProcedure
      .input(z.object({
        missionId: z.string().uuid(),
        choiceIndex: z.number().int().min(0).max(4),
        resolutionToken: z.string().uuid(),
      }))
      .mutation(async ({ ctx, input }) => {
        return service.resolveStep(
          ctx.userId!,
          input.missionId,
          input.choiceIndex,
          input.resolutionToken,
        );
      }),
  });
}
