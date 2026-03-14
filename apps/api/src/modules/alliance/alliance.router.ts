import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createAllianceService } from './alliance.service.js';

export function createAllianceRouter(allianceService: ReturnType<typeof createAllianceService>) {
  return router({
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(3).max(30),
        tag: z.string().min(2).max(8),
      }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.create(ctx.userId!, input.name, input.tag);
      }),

    update: protectedProcedure
      .input(z.object({ description: z.string().max(2000) }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.update(ctx.userId!, input.description);
      }),

    leave: protectedProcedure
      .mutation(async ({ ctx }) => {
        return allianceService.leave(ctx.userId!);
      }),

    kick: protectedProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.kick(ctx.userId!, input.userId);
      }),

    setRole: protectedProcedure
      .input(z.object({
        userId: z.string().uuid(),
        role: z.enum(['officer', 'member']),
      }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.setRole(ctx.userId!, input.userId, input.role);
      }),

    invite: protectedProcedure
      .input(z.object({ username: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.invite(ctx.userId!, input.username);
      }),

    respondInvitation: protectedProcedure
      .input(z.object({ invitationId: z.string().uuid(), accept: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.respondInvitation(ctx.userId!, input.invitationId, input.accept);
      }),

    apply: protectedProcedure
      .input(z.object({ allianceId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.apply(ctx.userId!, input.allianceId);
      }),

    respondApplication: protectedProcedure
      .input(z.object({ applicationId: z.string().uuid(), accept: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.respondApplication(ctx.userId!, input.applicationId, input.accept);
      }),

    sendCircular: protectedProcedure
      .input(z.object({
        subject: z.string().min(1).max(255),
        body: z.string().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        return allianceService.sendCircular(ctx.userId!, input.subject, input.body);
      }),

    get: protectedProcedure
      .input(z.object({ allianceId: z.string().uuid() }))
      .query(async ({ input }) => {
        return allianceService.get(input.allianceId);
      }),

    myAlliance: protectedProcedure
      .query(async ({ ctx }) => {
        return allianceService.myAlliance(ctx.userId!);
      }),

    myInvitations: protectedProcedure
      .query(async ({ ctx }) => {
        return allianceService.myInvitations(ctx.userId!);
      }),

    applications: protectedProcedure
      .query(async ({ ctx }) => {
        return allianceService.applications(ctx.userId!);
      }),

    ranking: protectedProcedure
      .input(z.object({ page: z.number().int().min(1).default(1) }).optional())
      .query(async ({ input }) => {
        return allianceService.ranking(input?.page);
      }),

    search: protectedProcedure
      .input(z.object({ query: z.string().min(1).max(100) }))
      .query(async ({ input }) => {
        return allianceService.search(input.query);
      }),
  });
}
