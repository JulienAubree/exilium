import { ilike, ne, and, or, eq, gt, count, sql } from 'drizzle-orm';
import { byUser } from '../../lib/db-helpers.js';
import { users, planets, rankings, allianceMembers, alliances, friendships, gameEvents, missionReports, messages } from '@exilium/db';
import type { Database } from '@exilium/db';
import { readdirSync } from 'fs';
import { join } from 'path';
import { TRPCError } from '@trpc/server';
import type { Blason } from '@exilium/shared';
import { ABSENCE_THRESHOLD_MS } from '../../lib/absence.js';

export function createUserService(db: Database, assetsDir: string) {
  const service = {
    async searchUsers(currentUserId: string, query: string) {
      const escaped = query.replace(/[%_]/g, '\\$&');
      return db
        .select({ id: users.id, username: users.username, avatarId: users.avatarId })
        .from(users)
        .where(and(
          ilike(users.username, `%${escaped}%`),
          ne(users.id, currentUserId),
        ))
        .limit(10);
    },

    async getMyProfile(userId: string) {
      const [user] = await db.select({
        id: users.id,
        username: users.username,
        bio: users.bio,
        avatarId: users.avatarId,
        playstyle: users.playstyle,
        seekingAlliance: users.seekingAlliance,
        profileVisibility: users.profileVisibility,
        createdAt: users.createdAt,
        emailVerifiedAt: users.emailVerifiedAt,
      }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      const stats = await service.getPlayerStats(userId);
      return { ...user, ...stats };
    },

    async getProfile(userId: string, currentUserId: string) {
      const [user] = await db.select({
        id: users.id,
        username: users.username,
        bio: users.bio,
        avatarId: users.avatarId,
        playstyle: users.playstyle,
        seekingAlliance: users.seekingAlliance,
        profileVisibility: users.profileVisibility,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      const visibility = (user.profileVisibility ?? { bio: true, playstyle: true, stats: true }) as Record<string, boolean>;
      const stats = await service.getPlayerStats(userId);
      const friendship = await service.getFriendshipStatus(userId, currentUserId);

      return {
        id: user.id,
        username: user.username,
        avatarId: user.avatarId,
        createdAt: user.createdAt,
        bio: (visibility.bio !== false) ? user.bio : null,
        playstyle: (visibility.playstyle !== false) ? user.playstyle : null,
        seekingAlliance: (visibility.playstyle !== false) ? user.seekingAlliance : null, // grouped with playstyle visibility
        stats: (visibility.stats !== false) ? stats : null,
        friendshipStatus: friendship.status,
        friendshipId: friendship.friendshipId,
      };
    },

    async updateProfile(userId: string, data: {
      bio?: string | null;
      avatarId?: string | null;
      seekingAlliance?: boolean;
      theme?: string;
      profileVisibility?: Record<string, boolean>;
    }) {
      if (data.avatarId !== undefined && data.avatarId !== null) {
        const avatars = service.listAvatars();
        if (!avatars.includes(data.avatarId)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Avatar invalide' });
        }
      }
      if (data.bio !== undefined && data.bio !== null && data.bio.length > 500) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bio trop longue (max 500)' });
      }

      const update: Record<string, unknown> = {};
      if (data.bio !== undefined) update.bio = data.bio;
      if (data.avatarId !== undefined) update.avatarId = data.avatarId;
      if (data.seekingAlliance !== undefined) update.seekingAlliance = data.seekingAlliance;
      if (data.profileVisibility !== undefined) update.profileVisibility = data.profileVisibility;

      if (Object.keys(update).length > 0) {
        await db.update(users).set(update).where(eq(users.id, userId));
      }
    },

    async getAbsenceSummary(userId: string) {
      const [user] = await db
        .select({ previousLoginAt: users.previousLoginAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });

      const empty = {
        hasAbsence: false as const,
        since: null,
        durationMs: 0,
        groups: {} as Record<string, number>,
        combats: 0,
        messages: 0,
      };

      const since = user.previousLoginAt;
      if (!since) return empty;
      const durationMs = Date.now() - since.getTime();
      if (durationMs < ABSENCE_THRESHOLD_MS) return empty;

      const [eventRows, combatRows, messageRows] = await Promise.all([
        db
          .select({ type: gameEvents.type, c: count() })
          .from(gameEvents)
          .where(and(eq(gameEvents.userId, userId), gt(gameEvents.createdAt, since)))
          .groupBy(gameEvents.type),
        db
          .select({ c: count() })
          .from(missionReports)
          .where(and(eq(missionReports.userId, userId), gt(missionReports.createdAt, since))),
        db
          .select({ c: count() })
          .from(messages)
          .where(and(
            eq(messages.recipientId, userId),
            gt(messages.createdAt, since),
            eq(messages.read, false),
          )),
      ]);

      const groups: Record<string, number> = {};
      for (const row of eventRows) groups[row.type] = Number(row.c);
      const combats = Number(combatRows[0]?.c ?? 0);
      const messagesCount = Number(messageRows[0]?.c ?? 0);

      const hasAny =
        Object.values(groups).some((c) => c > 0) || combats > 0 || messagesCount > 0;

      return {
        hasAbsence: hasAny,
        since,
        durationMs,
        groups,
        combats,
        messages: messagesCount,
      };
    },

    async dismissAbsenceSummary(userId: string) {
      await db
        .update(users)
        .set({ previousLoginAt: sql`now()` })
        .where(eq(users.id, userId));
    },

    listAvatars(): string[] {
      try {
        const dir = join(assetsDir, 'avatars');
        return readdirSync(dir)
          .filter(f => /^\d+\.webp$/.test(f))
          .map(f => f.replace('.webp', ''))
          .sort((a, b) => Number(a) - Number(b));
      } catch {
        return [];
      }
    },

    async getPlayerStats(userId: string) {
      const [ranking] = await db.select({
        rank: rankings.rank,
        totalPoints: rankings.totalPoints,
      }).from(rankings).where(byUser(rankings.userId, userId)).limit(1);

      const [planetCount] = await db.select({
        count: count(),
      }).from(planets).where(byUser(planets.userId, userId));

      const [membership] = await db.select({
        allianceName: alliances.name,
        allianceTag: alliances.tag,
        allianceId: alliances.id,
        allianceRole: allianceMembers.role,
        blasonShape: alliances.blasonShape,
        blasonIcon: alliances.blasonIcon,
        blasonColor1: alliances.blasonColor1,
        blasonColor2: alliances.blasonColor2,
      }).from(allianceMembers)
        .innerJoin(alliances, eq(allianceMembers.allianceId, alliances.id))
        .where(byUser(allianceMembers.userId, userId))
        .limit(1);

      return {
        rank: ranking?.rank ?? null,
        totalPoints: ranking?.totalPoints ?? 0,
        planetCount: planetCount?.count ?? 0,
        allianceName: membership?.allianceName ?? null,
        allianceTag: membership?.allianceTag ?? null,
        allianceId: membership?.allianceId ?? null,
        allianceRole: membership?.allianceRole ?? null,
        allianceBlason: membership
          ? {
              shape: membership.blasonShape as Blason['shape'],
              icon: membership.blasonIcon as Blason['icon'],
              color1: membership.blasonColor1,
              color2: membership.blasonColor2,
            } satisfies Blason
          : null,
      };
    },

    async getFriendshipStatus(targetUserId: string, currentUserId: string): Promise<{ status: 'none' | 'pending_sent' | 'pending_received' | 'friends'; friendshipId: string | null }> {
      const [fs] = await db.select()
        .from(friendships)
        .where(or(
          and(eq(friendships.requesterId, currentUserId), eq(friendships.addresseeId, targetUserId)),
          and(eq(friendships.requesterId, targetUserId), eq(friendships.addresseeId, currentUserId)),
        ))
        .limit(1);

      if (!fs) return { status: 'none', friendshipId: null };
      if (fs.status === 'accepted') return { status: 'friends', friendshipId: fs.id };
      if (fs.requesterId === currentUserId) return { status: 'pending_sent', friendshipId: fs.id };
      return { status: 'pending_received', friendshipId: fs.id };
    },
  };

  return service;
}
