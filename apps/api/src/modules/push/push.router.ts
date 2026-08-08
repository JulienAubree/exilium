import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc/router.js';
import type { createPushService } from './push.service.js';

export function createPushRouter(pushService: ReturnType<typeof createPushService>) {
  return router({
    getPublicKey: protectedProcedure.query(() => {
      return { publicKey: pushService.getPublicKey() };
    }),

    subscribe: protectedProcedure
      .input(z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        await pushService.subscribe(ctx.userId, input);
        return { ok: true };
      }),

    // Les préférences push par-abonnement ont été remplacées par la table
    // `notification_preferences` (UI retirée le 2026-03-31). Les procédures
    // unsubscribe/getPreferences/updatePreferences n'avaient plus aucun
    // appelant. L'élagage des abonnements morts se fait via l'auto-delete
    // sur 404/410 dans `sendToUser`.
  });
}
