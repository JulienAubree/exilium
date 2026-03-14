import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createMessageService } from './message.service.js';

export function createMessageRouter(messageService: ReturnType<typeof createMessageService>) {
  return router({
    inbox: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
        type: z.enum(['system', 'player', 'combat', 'espionage', 'colonization', 'alliance']).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return messageService.listMessages(ctx.userId!, input);
      }),

    detail: protectedProcedure
      .input(z.object({ messageId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        return messageService.getMessage(ctx.userId!, input.messageId);
      }),

    send: protectedProcedure
      .input(z.object({
        recipientUsername: z.string().min(1).max(64),
        subject: z.string().min(1).max(255),
        body: z.string().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        return messageService.sendMessage(ctx.userId!, input.recipientUsername, input.subject, input.body);
      }),

    markAsRead: protectedProcedure
      .input(z.object({ messageId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return messageService.markAsRead(ctx.userId!, input.messageId);
      }),

    delete: protectedProcedure
      .input(z.object({ messageId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        return messageService.deleteMessage(ctx.userId!, input.messageId);
      }),

    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        return messageService.countUnread(ctx.userId!);
      }),
  });
}
