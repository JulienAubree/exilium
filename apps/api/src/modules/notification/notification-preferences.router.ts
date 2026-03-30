import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createNotificationPreferencesService } from './notification-preferences.service.js';

const disabledArray = z.array(z.string().min(1).max(64));

export function createNotificationPreferencesRouter(
  service: ReturnType<typeof createNotificationPreferencesService>,
) {
  return router({
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      return service.getPreferences(ctx.userId!);
    }),

    updatePreferences: protectedProcedure
      .input(z.object({
        toastDisabled: disabledArray,
        pushDisabled: disabledArray,
        bellDisabled: disabledArray,
      }))
      .mutation(async ({ ctx, input }) => {
        return service.updatePreferences(ctx.userId!, input);
      }),
  });
}
