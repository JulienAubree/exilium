import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createAdminProcedure } from '../../trpc/router.js';
import type { createExplorationContentService } from './exploration-content.service.js';
import type { createExplorationMissionService } from '../exploration-mission/exploration-mission.service.js';
import { explorationContentSchema } from './exploration-content.types.js';
import { explorationMissions } from '@exilium/db';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '@exilium/db';

/**
 * Endpoints admin pour le contenu des Missions d'exploration en espace
 * profond. Pattern calque sur anomaly-content.router (CRUD du JSONB +
 * kill-switch). Plus debug live (missions par joueur, force-resolve).
 */
export function createExplorationContentRouter(
  contentService: ReturnType<typeof createExplorationContentService>,
  missionService: ReturnType<typeof createExplorationMissionService>,
  adminProcedure: ReturnType<typeof createAdminProcedure>,
  db: Database,
) {
  const adminRouter = router({
    /** Sauvegarde complète du contenu (validation Zod stricte). */
    update: adminProcedure
      .input(explorationContentSchema)
      .mutation(async ({ input }) => {
        return contentService.updateContent(input);
      }),

    /** Restaure le seed initial. */
    reset: adminProcedure.mutation(async () => {
      return contentService.resetContent();
    }),

    /** Active/désactive la génération de nouvelles offres. Runs en cours non affectés. */
    setKillSwitch: adminProcedure
      .input(z.object({ killSwitch: z.boolean() }))
      .mutation(async ({ input }) => {
        return contentService.setKillSwitch(input.killSwitch);
      }),

    /** Liste filtrable des missions live (debug + actions admin). */
    listMissions: adminProcedure
      .input(z.object({
        status: z.enum(['available', 'engaged', 'awaiting_decision', 'completed', 'failed', 'expired']).optional(),
        userId: z.string().uuid().optional(),
        tier: z.enum(['early', 'mid', 'deep']).optional(),
        sectorId: z.string().optional(),
        zombie: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }))
      .query(async ({ input }) => {
        const conditions = [];
        if (input.status) conditions.push(eq(explorationMissions.status, input.status));
        if (input.userId) conditions.push(eq(explorationMissions.userId, input.userId));
        if (input.tier) conditions.push(eq(explorationMissions.tier, input.tier));
        if (input.sectorId) conditions.push(eq(explorationMissions.sectorId, input.sectorId));
        if (input.zombie) {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
          conditions.push(eq(explorationMissions.status, 'awaiting_decision'));
          conditions.push(lt(explorationMissions.engagedAt, sevenDaysAgo));
        }
        const rows = await db
          .select()
          .from(explorationMissions)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(explorationMissions.createdAt))
          .limit(input.limit);
        return { missions: rows };
      }),

    /** Force l'expiration d'une mission (status='expired', flotte renvoyée). */
    expireMission: adminProcedure
      .input(z.object({ missionId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        await db.update(explorationMissions)
          .set({ status: 'expired', completedAt: new Date() })
          .where(eq(explorationMissions.id, input.missionId));
        return { success: true };
      }),

    /**
     * Force la résolution du step en cours avec le choice spécifié.
     * Bypass les requirements (équivalent admin override). Utile pour
     * débloquer une mission zombie ou tester un outcome.
     */
    forceResolveStep: adminProcedure
      .input(z.object({
        missionId: z.string().uuid(),
        choiceIndex: z.number().int().min(0).max(4),
      }))
      .mutation(async ({ input }) => {
        const [mission] = await db
          .select({ userId: explorationMissions.userId })
          .from(explorationMissions)
          .where(eq(explorationMissions.id, input.missionId))
          .limit(1);
        if (!mission) {
          throw new Error('Mission introuvable');
        }
        const token = crypto.randomUUID();
        return missionService.resolveStep(
          mission.userId,
          input.missionId,
          input.choiceIndex,
          token,
        );
      }),
  });

  return router({
    /** Lecture publique du contenu (utile pour le front affichage). */
    get: protectedProcedure.query(async () => {
      return contentService.getContent();
    }),
    admin: adminRouter,
  });
}
