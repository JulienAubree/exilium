import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import { NOTIFICATION_CATEGORIES } from '@exilium/shared';
import type { createNotificationPreferencesService } from './notification-preferences.service.js';

const categoryEnum = z.enum(NOTIFICATION_CATEGORIES as unknown as [string, ...string[]]);

export function createNotificationPreferencesRouter(
  service: ReturnType<typeof createNotificationPreferencesService>,
) {
  return router({
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      return service.getPreferences(ctx.userId!);
    }),

    updatePreferences: protectedProcedure
      .input(z.object({
        toastDisabled: z.array(categoryEnum),
        pushDisabled: z.array(categoryEnum),
        bellDisabled: z.array(categoryEnum),
      }))
      .mutation(async ({ ctx, input }) => {
        return service.updatePreferences(ctx.userId!, input);
      }),
  });
}
