import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createFleetPresetService } from './fleet-preset.service.js';

const shipsSchema = z.record(z.string(), z.number().int().min(0).max(999999));
const nameSchema = z.string().trim().min(1).max(64);

export function createFleetPresetRouter(service: ReturnType<typeof createFleetPresetService>) {
  return router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return service.list(ctx.userId!);
    }),

    create: protectedProcedure
      .input(z.object({ name: nameSchema, ships: shipsSchema }))
      .mutation(async ({ ctx, input }) => {
        return service.create(ctx.userId!, input.name, input.ships);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: nameSchema.optional(),
          ships: shipsSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return service.update(ctx.userId!, input.id, { name: input.name, ships: input.ships });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return service.delete(ctx.userId!, input.id);
      }),
  });
}
