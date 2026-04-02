import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createChangelogService } from './changelog.service.js';
import type { createAdminProcedure } from '../../trpc/router.js';

export function createChangelogRouter(
  changelogService: ReturnType<typeof createChangelogService>,
  adminProcedure: ReturnType<typeof createAdminProcedure>,
) {
  const adminRouter = router({
    list: adminProcedure
      .query(async () => {
        return changelogService.adminList();
      }),

    update: adminProcedure
      .input(z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(256).optional(),
        content: z.string().optional(),
        published: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return changelogService.adminUpdate(input.id, input);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        return changelogService.adminDelete(input.id);
      }),

    generate: adminProcedure
      .mutation(async () => {
        return changelogService.adminGenerate();
      }),
  });

  return router({
    list: protectedProcedure
      .input(z.object({
        cursor: z.string().uuid().optional(),
      }).optional())
      .query(async ({ input }) => {
        return changelogService.list(input?.cursor);
      }),

    detail: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        return changelogService.detail(input.id);
      }),

    comment: protectedProcedure
      .input(z.object({
        changelogId: z.string().uuid(),
        content: z.string().min(1).max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        return changelogService.comment(ctx.userId!, input.changelogId, input.content);
      }),

    deleteComment: protectedProcedure
      .input(z.object({ commentId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return changelogService.deleteComment(ctx.userId!, input.commentId);
      }),

    admin: adminRouter,
  });
}
