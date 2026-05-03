import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createAdminProcedure } from '../../trpc/router.js';
import type { createModulesService } from './modules.service.js';
import { moduleDefinitionSchema } from './modules.types.js';

export function createModulesRouter(
  service: ReturnType<typeof createModulesService>,
  adminProcedure: ReturnType<typeof createAdminProcedure>,
) {
  const adminRouter = router({
    list: adminProcedure.query(() => service.listAll()),
    upsert: adminProcedure.input(moduleDefinitionSchema).mutation(({ input }) => service.adminUpsert(input)),
    delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ input }) => service.adminDelete(input.id)),
  });

  const inventoryRouter = router({
    list: protectedProcedure.query(({ ctx }) => service.getInventory(ctx.userId!)),
  });

  const loadoutRouter = router({
    get: protectedProcedure.input(z.object({ hullId: z.string() })).query(({ ctx, input }) => service.getLoadout(ctx.userId!, input.hullId)),
    equip: protectedProcedure.input(z.object({
      hullId: z.string(),
      slotType: z.enum(['epic', 'rare', 'common']),
      slotIndex: z.number().int().min(0).max(4),
      moduleId: z.string(),
    })).mutation(({ ctx, input }) => service.equip(ctx.userId!, input)),
    unequip: protectedProcedure.input(z.object({
      hullId: z.string(),
      slotType: z.enum(['epic', 'rare', 'common']),
      slotIndex: z.number().int().min(0).max(4),
    })).mutation(({ ctx, input }) => service.unequip(ctx.userId!, input)),
  });

  return router({
    list: protectedProcedure.query(() => service.listAll()),
    inventory: inventoryRouter,
    loadout: loadoutRouter,
    admin: adminRouter,
  });
}
