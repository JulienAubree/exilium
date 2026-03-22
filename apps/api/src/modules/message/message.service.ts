import { eq, and, desc, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { messages, users } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import type Redis from 'ioredis';
import { publishNotification } from '../notification/notification.publisher.js';

export function createMessageService(db: Database, redis: Redis) {
  return {
    async sendMessage(senderId: string, recipientUsername: string, subject: string, body: string, threadId?: string) {
      const [recipient] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, recipientUsername))
        .limit(1);

      if (!recipient) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Joueur introuvable' });
      }

      if (recipient.id === senderId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous ne pouvez pas vous envoyer un message' });
      }

      // Auto-detect existing thread between the two users
      let existingThreadId: string | undefined;
      const [existingThread] = await db
        .select({ threadId: messages.threadId })
        .from(messages)
        .where(
          and(
            eq(messages.type, 'player'),
            sql`${messages.threadId} IS NOT NULL`,
            or(
              and(eq(messages.senderId, senderId), eq(messages.recipientId, recipient.id)),
              and(eq(messages.senderId, recipient.id), eq(messages.recipientId, senderId)),
            ),
          ),
        )
        .limit(1);

      if (existingThread) {
        existingThreadId = existingThread.threadId!;
      }

      const [msg] = await db
        .insert(messages)
        .values({
          senderId,
          recipientId: recipient.id,
          type: 'player',
          subject,
          body,
          threadId: existingThreadId ?? undefined,
        })
        .returning();

      // Only create a new thread (self-referential) if no existing thread was found
      if (!existingThreadId) {
        await db
          .update(messages)
          .set({ threadId: msg.id })
          .where(eq(messages.id, msg.id));
        msg.threadId = msg.id;
      }

      const [sender] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, senderId))
        .limit(1);

      publishNotification(redis, recipient.id, {
        type: 'new-message',
        payload: { messageId: msg.id, type: 'player', subject, senderUsername: sender?.username ?? null, senderId },
      });

      return msg;
    },

    async replyToMessage(senderId: string, originalMessageId: string, body: string) {
      // Find the original message to get thread info
      const [original] = await db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          recipientId: messages.recipientId,
          subject: messages.subject,
          threadId: messages.threadId,
          type: messages.type,
        })
        .from(messages)
        .where(eq(messages.id, originalMessageId))
        .limit(1);

      if (!original) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message introuvable' });
      }

      if (original.type !== 'player') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Impossible de répondre à ce type de message' });
      }

      // Determine the recipient (the other person in the conversation)
      const recipientId = original.senderId === senderId ? original.recipientId : original.senderId;
      if (!recipientId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Destinataire introuvable' });
      }

      // Verify sender is part of this conversation
      if (original.senderId !== senderId && original.recipientId !== senderId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Vous ne faites pas partie de cette conversation' });
      }

      const threadId = original.threadId ?? original.id;
      const subject = original.subject.startsWith('Re: ') ? original.subject : `Re: ${original.subject}`;

      const [msg] = await db
        .insert(messages)
        .values({
          senderId,
          recipientId,
          type: 'player',
          subject,
          body,
          threadId,
        })
        .returning();

      const [sender] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, senderId))
        .limit(1);

      publishNotification(redis, recipientId, {
        type: 'new-message',
        payload: { messageId: msg.id, type: 'player', subject, senderUsername: sender?.username ?? null, senderId },
      });

      return msg;
    },

    async createSystemMessage(
      recipientId: string,
      type: 'system' | 'colonization' | 'espionage' | 'combat' | 'alliance' | 'mission',
      subject: string,
      body: string,
    ) {
      const [msg] = await db
        .insert(messages)
        .values({
          senderId: null,
          recipientId,
          type,
          subject,
          body,
        })
        .returning();

      return msg;
    },

    async listMessages(
      userId: string,
      options?: { page?: number; limit?: number; type?: 'system' | 'colonization' | 'player' | 'espionage' | 'combat' | 'alliance' | 'mission' },
    ) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const offset = (page - 1) * limit;

      const conditions = [eq(messages.recipientId, userId)];
      if (options?.type) {
        conditions.push(eq(messages.type, options.type));
      }

      return db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          senderUsername: users.username,
          type: messages.type,
          subject: messages.subject,
          read: messages.read,
          threadId: messages.threadId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async listSentMessages(
      userId: string,
      options?: { page?: number; limit?: number },
    ) {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const offset = (page - 1) * limit;

      // Alias for the recipient user
      const recipientUser = users;

      return db
        .select({
          id: messages.id,
          recipientId: messages.recipientId,
          recipientUsername: recipientUser.username,
          type: messages.type,
          subject: messages.subject,
          readBySender: messages.readBySender,
          read: messages.read,
          threadId: messages.threadId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(recipientUser, eq(recipientUser.id, messages.recipientId))
        .where(and(eq(messages.senderId, userId), eq(messages.type, 'player')))
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async getThread(userId: string, threadId: string) {
      // Mark all unread messages in this thread where user is recipient as read
      await db
        .update(messages)
        .set({ read: true })
        .where(
          and(
            eq(messages.threadId, threadId),
            eq(messages.recipientId, userId),
            eq(messages.read, false),
          ),
        );

      // Mark readBySender for messages where user is sender
      await db
        .update(messages)
        .set({ readBySender: true })
        .where(
          and(
            eq(messages.threadId, threadId),
            eq(messages.senderId, userId),
            eq(messages.readBySender, false),
          ),
        );

      return db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          senderUsername: users.username,
          recipientId: messages.recipientId,
          type: messages.type,
          subject: messages.subject,
          body: messages.body,
          read: messages.read,
          readBySender: messages.readBySender,
          threadId: messages.threadId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(
          and(
            eq(messages.threadId, threadId),
            or(eq(messages.senderId, userId), eq(messages.recipientId, userId)),
          ),
        )
        .orderBy(messages.createdAt);
    },

    async getMessage(userId: string, messageId: string) {
      const [msg] = await db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          senderUsername: users.username,
          recipientId: messages.recipientId,
          type: messages.type,
          subject: messages.subject,
          body: messages.body,
          read: messages.read,
          readBySender: messages.readBySender,
          threadId: messages.threadId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(
          and(
            eq(messages.id, messageId),
            or(eq(messages.recipientId, userId), eq(messages.senderId, userId)),
          ),
        )
        .limit(1);

      if (!msg) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message introuvable' });
      }

      // Mark as read by recipient
      if (msg.recipientId === userId && !msg.read) {
        await db
          .update(messages)
          .set({ read: true })
          .where(eq(messages.id, messageId));
      }

      // Mark as read by sender (when sender views the message detail)
      if (msg.senderId === userId && !msg.readBySender) {
        await db
          .update(messages)
          .set({ readBySender: true })
          .where(eq(messages.id, messageId));
      }

      return {
        ...msg,
        read: msg.recipientId === userId ? true : msg.read,
        readBySender: msg.senderId === userId ? true : msg.readBySender,
      };
    },

    async markAsRead(userId: string, messageId: string) {
      await db
        .update(messages)
        .set({ read: true })
        .where(and(eq(messages.id, messageId), eq(messages.recipientId, userId)));

      return { success: true };
    },

    async deleteMessage(userId: string, messageId: string) {
      await db
        .delete(messages)
        .where(
          and(
            eq(messages.id, messageId),
            or(eq(messages.recipientId, userId), eq(messages.senderId, userId)),
          ),
        );

      return { success: true };
    },

    async countUnread(userId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(eq(messages.recipientId, userId), eq(messages.read, false), eq(messages.type, 'player')));

      return result?.count ?? 0;
    },

    async listConversations(userId: string) {
      // Step 1: Get all distinct threadIds where user participates (player messages only)
      const threads = await db
        .select({
          threadId: messages.threadId,
          lastCreatedAt: sql<Date>`MAX(${messages.createdAt})`.as('last_created_at'),
        })
        .from(messages)
        .where(
          and(
            or(eq(messages.senderId, userId), eq(messages.recipientId, userId)),
            eq(messages.type, 'player'),
            sql`${messages.threadId} IS NOT NULL`,
          ),
        )
        .groupBy(messages.threadId)
        .orderBy(sql`MAX(${messages.createdAt}) DESC`);

      if (threads.length === 0) return [];

      // Step 2: For each thread, get last message + other user + unread count
      const results = await Promise.all(
        threads.map(async (t) => {
          const [lastMsg] = await db
            .select({
              body: messages.body,
              senderId: messages.senderId,
              recipientId: messages.recipientId,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(eq(messages.threadId, t.threadId!))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          if (!lastMsg) return null;

          const otherUserId = lastMsg.senderId === userId ? lastMsg.recipientId : lastMsg.senderId;
          if (!otherUserId) return null;

          const [otherUser] = await db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(eq(users.id, otherUserId))
            .limit(1);

          if (!otherUser) return null;

          const [unreadResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(messages)
            .where(
              and(
                eq(messages.threadId, t.threadId!),
                eq(messages.recipientId, userId),
                eq(messages.read, false),
              ),
            );

          return {
            threadId: t.threadId!,
            otherUser: { id: otherUser.id, username: otherUser.username },
            lastMessage: {
              body: lastMsg.body,
              senderId: lastMsg.senderId,
              createdAt: lastMsg.createdAt,
            },
            unreadCount: unreadResult?.count ?? 0,
          };
        }),
      );

      return results.filter(Boolean);
    },

    async deleteThread(userId: string, threadId: string) {
      await db
        .delete(messages)
        .where(
          and(
            eq(messages.threadId, threadId),
            or(eq(messages.senderId, userId), eq(messages.recipientId, userId)),
          ),
        );
      return { success: true };
    },
  };
}
