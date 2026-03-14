# Phase 6b: Alliances — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an alliance system with creation, recruitment (invitation + application), roles, circular messages, alliance ranking, and alliance tags in galaxy view.

**Architecture:** New DB schema (alliances, members, invitations, applications) + alliance service/router following existing factory patterns. Galaxy service joins alliance tags. Two new frontend pages (Alliance, AllianceRanking) plus updates to Sidebar, Galaxy, Messages.

**Tech Stack:** Drizzle ORM, tRPC, React, Zustand patterns

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/db/src/schema/alliances.ts` | Create | 4 tables + 2 enums |
| `packages/db/src/schema/messages.ts` | Modify | Add 'alliance' to messageTypeEnum |
| `packages/db/src/schema/index.ts` | Modify | Export alliances |
| `apps/api/src/modules/alliance/alliance.service.ts` | Create | Alliance business logic |
| `apps/api/src/modules/alliance/alliance.router.ts` | Create | tRPC routes |
| `apps/api/src/trpc/app-router.ts` | Modify | Wire alliance module |
| `apps/api/src/modules/galaxy/galaxy.service.ts` | Modify | Join alliance tag |
| `apps/api/src/modules/message/message.service.ts` | Modify | Accept 'alliance' type |
| `apps/api/src/modules/message/message.router.ts` | Modify | Add 'alliance' to z.enum |
| `apps/web/src/pages/Alliance.tsx` | Create | Alliance page |
| `apps/web/src/pages/AllianceRanking.tsx` | Create | Alliance ranking page |
| `apps/web/src/components/layout/Sidebar.tsx` | Modify | Add nav links |
| `apps/web/src/router.tsx` | Modify | Add routes |
| `apps/web/src/pages/Galaxy.tsx` | Modify | Show [TAG] |
| `apps/web/src/pages/Messages.tsx` | Modify | Add Alliance filter |

---

## Chunk 1: Database Schema

### Task 1: Create alliance schema + update messages enum

**Files:**
- Create: `packages/db/src/schema/alliances.ts`
- Modify: `packages/db/src/schema/messages.ts:4`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create alliances schema**

Create `packages/db/src/schema/alliances.ts`:

```typescript
import { pgTable, uuid, varchar, text, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const allianceRoleEnum = pgEnum('alliance_role', ['founder', 'officer', 'member']);
export const requestStatusEnum = pgEnum('request_status', ['pending', 'accepted', 'declined']);

export const alliances = pgTable('alliances', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 30 }).notNull().unique(),
  tag: varchar('tag', { length: 8 }).notNull().unique(),
  description: text('description'),
  founderId: uuid('founder_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const allianceMembers = pgTable('alliance_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  allianceId: uuid('alliance_id').notNull().references(() => alliances.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  role: allianceRoleEnum('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});

export const allianceInvitations = pgTable('alliance_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  allianceId: uuid('alliance_id').notNull().references(() => alliances.id, { onDelete: 'cascade' }),
  invitedUserId: uuid('invited_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedByUserId: uuid('invited_by_user_id').notNull().references(() => users.id),
  status: requestStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('unique_alliance_invitation').on(table.allianceId, table.invitedUserId),
]);

export const allianceApplications = pgTable('alliance_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  allianceId: uuid('alliance_id').notNull().references(() => alliances.id, { onDelete: 'cascade' }),
  applicantUserId: uuid('applicant_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: requestStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('unique_alliance_application').on(table.allianceId, table.applicantUserId),
]);
```

- [ ] **Step 2: Add 'alliance' to messageTypeEnum**

In `packages/db/src/schema/messages.ts:4`, change:
```typescript
export const messageTypeEnum = pgEnum('message_type', ['system', 'colonization', 'player', 'espionage', 'combat']);
```
to:
```typescript
export const messageTypeEnum = pgEnum('message_type', ['system', 'colonization', 'player', 'espionage', 'combat', 'alliance']);
```

- [ ] **Step 3: Export alliances from schema index**

In `packages/db/src/schema/index.ts`, add:
```typescript
export * from './alliances.js';
```

- [ ] **Step 4: Generate migration**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm drizzle-kit generate`

- [ ] **Step 5: Typecheck**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && pnpm turbo typecheck --filter=@ogame-clone/db`

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add alliance schema and 'alliance' message type"
```

---

## Chunk 2: Alliance Service + Router + Wiring

### Task 2: Create alliance service

**Files:**
- Create: `apps/api/src/modules/alliance/alliance.service.ts`

- [ ] **Step 1: Create the service**

Create `apps/api/src/modules/alliance/alliance.service.ts` with the full implementation. This is a large file — see complete code below.

```typescript
import { eq, and, ilike, or, sql, asc, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { alliances, allianceMembers, allianceInvitations, allianceApplications, users, rankings } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import type { createMessageService } from '../message/message.service.js';

type MessageService = ReturnType<typeof createMessageService>;

async function getMembership(db: Database, userId: string) {
  const [membership] = await db
    .select({
      id: allianceMembers.id,
      allianceId: allianceMembers.allianceId,
      role: allianceMembers.role,
    })
    .from(allianceMembers)
    .where(eq(allianceMembers.userId, userId))
    .limit(1);
  return membership ?? null;
}

async function requireRole(db: Database, userId: string, roles: string[]) {
  const membership = await getMembership(db, userId);
  if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'Vous n\'êtes pas dans une alliance.' });
  if (!roles.includes(membership.role)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Vous n\'avez pas la permission.' });
  return membership;
}

export function createAllianceService(db: Database, messageService: MessageService) {
  return {
    async create(userId: string, name: string, tag: string) {
      const existing = await getMembership(db, userId);
      if (existing) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous êtes déjà dans une alliance.' });

      const [alliance] = await db.insert(alliances).values({ name, tag: tag.toUpperCase(), founderId: userId }).returning();
      await db.insert(allianceMembers).values({ allianceId: alliance.id, userId, role: 'founder' });
      return alliance;
    },

    async update(userId: string, description: string) {
      const membership = await requireRole(db, userId, ['founder', 'officer']);
      await db.update(alliances).set({ description }).where(eq(alliances.id, membership.allianceId));
      return { success: true };
    },

    async leave(userId: string) {
      const membership = await getMembership(db, userId);
      if (!membership) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous n\'êtes pas dans une alliance.' });

      const members = await db.select().from(allianceMembers).where(eq(allianceMembers.allianceId, membership.allianceId));

      if (members.length === 1) {
        // Last member — dissolve
        await db.delete(alliances).where(eq(alliances.id, membership.allianceId));
        return { dissolved: true };
      }

      if (membership.role === 'founder') {
        // Transfer founder role
        const successor = members
          .filter((m) => m.userId !== userId)
          .sort((a, b) => {
            if (a.role === 'officer' && b.role !== 'officer') return -1;
            if (b.role === 'officer' && a.role !== 'officer') return 1;
            return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
          })[0];

        await db.update(allianceMembers).set({ role: 'founder' }).where(eq(allianceMembers.id, successor.id));
        await db.update(alliances).set({ founderId: successor.userId }).where(eq(alliances.id, membership.allianceId));
      }

      await db.delete(allianceMembers).where(eq(allianceMembers.id, membership.id));
      return { dissolved: false };
    },

    async kick(userId: string, targetUserId: string) {
      const membership = await requireRole(db, userId, ['founder', 'officer']);

      const [target] = await db
        .select()
        .from(allianceMembers)
        .where(and(eq(allianceMembers.allianceId, membership.allianceId), eq(allianceMembers.userId, targetUserId)))
        .limit(1);

      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Membre introuvable.' });
      if (target.role === 'founder') throw new TRPCError({ code: 'FORBIDDEN', message: 'Impossible d\'expulser le fondateur.' });
      if (target.role === 'officer' && membership.role !== 'founder') throw new TRPCError({ code: 'FORBIDDEN', message: 'Seul le fondateur peut expulser un officier.' });

      await db.delete(allianceMembers).where(eq(allianceMembers.id, target.id));
      return { success: true };
    },

    async setRole(userId: string, targetUserId: string, role: 'officer' | 'member') {
      await requireRole(db, userId, ['founder']);

      const membership = await getMembership(db, userId);
      const [target] = await db
        .select()
        .from(allianceMembers)
        .where(and(eq(allianceMembers.allianceId, membership!.allianceId), eq(allianceMembers.userId, targetUserId)))
        .limit(1);

      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Membre introuvable.' });
      if (target.userId === userId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous ne pouvez pas changer votre propre rôle.' });

      await db.update(allianceMembers).set({ role }).where(eq(allianceMembers.id, target.id));
      return { success: true };
    },

    async invite(userId: string, targetUsername: string) {
      const membership = await requireRole(db, userId, ['founder', 'officer']);

      const [targetUser] = await db.select({ id: users.id }).from(users).where(eq(users.username, targetUsername)).limit(1);
      if (!targetUser) throw new TRPCError({ code: 'NOT_FOUND', message: 'Joueur introuvable.' });

      const targetMembership = await getMembership(db, targetUser.id);
      if (targetMembership) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce joueur est déjà dans une alliance.' });

      const [existingInvite] = await db
        .select()
        .from(allianceInvitations)
        .where(and(
          eq(allianceInvitations.allianceId, membership.allianceId),
          eq(allianceInvitations.invitedUserId, targetUser.id),
          eq(allianceInvitations.status, 'pending'),
        ))
        .limit(1);

      if (existingInvite) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Une invitation est déjà en attente pour ce joueur.' });

      const [alliance] = await db.select({ name: alliances.name, tag: alliances.tag }).from(alliances).where(eq(alliances.id, membership.allianceId)).limit(1);
      await db.insert(allianceInvitations).values({ allianceId: membership.allianceId, invitedUserId: targetUser.id, invitedByUserId: userId });
      await messageService.createSystemMessage(targetUser.id, 'alliance', `Invitation alliance [${alliance.tag}]`, `Vous avez été invité à rejoindre l'alliance ${alliance.name} [${alliance.tag}].`);
      return { success: true };
    },

    async respondInvitation(userId: string, invitationId: string, accept: boolean) {
      const [invitation] = await db.select().from(allianceInvitations).where(and(eq(allianceInvitations.id, invitationId), eq(allianceInvitations.invitedUserId, userId))).limit(1);
      if (!invitation || invitation.status !== 'pending') throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation introuvable.' });

      if (accept) {
        const existing = await getMembership(db, userId);
        if (existing) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous êtes déjà dans une alliance.' });
        await db.insert(allianceMembers).values({ allianceId: invitation.allianceId, userId, role: 'member' });
      }

      await db.update(allianceInvitations).set({ status: accept ? 'accepted' : 'declined' }).where(eq(allianceInvitations.id, invitationId));
      return { success: true };
    },

    async apply(userId: string, allianceId: string) {
      const existing = await getMembership(db, userId);
      if (existing) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous êtes déjà dans une alliance.' });

      const [alliance] = await db.select().from(alliances).where(eq(alliances.id, allianceId)).limit(1);
      if (!alliance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Alliance introuvable.' });

      const [existingApp] = await db
        .select()
        .from(allianceApplications)
        .where(and(eq(allianceApplications.allianceId, allianceId), eq(allianceApplications.applicantUserId, userId), eq(allianceApplications.status, 'pending')))
        .limit(1);

      if (existingApp) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Vous avez déjà une candidature en attente.' });

      await db.insert(allianceApplications).values({ allianceId, applicantUserId: userId });

      // Notify all founders + officers
      const leaders = await db
        .select({ userId: allianceMembers.userId })
        .from(allianceMembers)
        .where(and(eq(allianceMembers.allianceId, allianceId), or(eq(allianceMembers.role, 'founder'), eq(allianceMembers.role, 'officer'))));

      const [applicant] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
      for (const leader of leaders) {
        await messageService.createSystemMessage(leader.userId, 'alliance', `Candidature [${alliance.tag}]`, `${applicant.username} a postulé pour rejoindre votre alliance.`);
      }

      return { success: true };
    },

    async respondApplication(userId: string, applicationId: string, accept: boolean) {
      await requireRole(db, userId, ['founder', 'officer']);
      const membership = await getMembership(db, userId);

      const [application] = await db.select().from(allianceApplications).where(and(eq(allianceApplications.id, applicationId), eq(allianceApplications.allianceId, membership!.allianceId))).limit(1);
      if (!application || application.status !== 'pending') throw new TRPCError({ code: 'NOT_FOUND', message: 'Candidature introuvable.' });

      if (accept) {
        const existingMembership = await getMembership(db, application.applicantUserId);
        if (existingMembership) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce joueur est déjà dans une alliance.' });
        await db.insert(allianceMembers).values({ allianceId: membership!.allianceId, userId: application.applicantUserId, role: 'member' });
      }

      await db.update(allianceApplications).set({ status: accept ? 'accepted' : 'declined' }).where(eq(allianceApplications.id, applicationId));
      return { success: true };
    },

    async sendCircular(userId: string, subject: string, body: string) {
      const membership = await requireRole(db, userId, ['founder', 'officer']);

      const members = await db
        .select({ userId: allianceMembers.userId })
        .from(allianceMembers)
        .where(eq(allianceMembers.allianceId, membership.allianceId));

      for (const member of members) {
        if (member.userId === userId) continue;
        await messageService.createSystemMessage(member.userId, 'alliance', subject, body);
      }

      return { success: true, recipientCount: members.length - 1 };
    },

    async get(allianceId: string) {
      const [alliance] = await db.select().from(alliances).where(eq(alliances.id, allianceId)).limit(1);
      if (!alliance) throw new TRPCError({ code: 'NOT_FOUND', message: 'Alliance introuvable.' });

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(allianceMembers)
        .where(eq(allianceMembers.allianceId, allianceId));

      return { ...alliance, memberCount: countResult.count };
    },

    async myAlliance(userId: string) {
      const membership = await getMembership(db, userId);
      if (!membership) return null;

      const [alliance] = await db.select().from(alliances).where(eq(alliances.id, membership.allianceId)).limit(1);
      const members = await db
        .select({
          userId: allianceMembers.userId,
          username: users.username,
          role: allianceMembers.role,
          joinedAt: allianceMembers.joinedAt,
        })
        .from(allianceMembers)
        .innerJoin(users, eq(users.id, allianceMembers.userId))
        .where(eq(allianceMembers.allianceId, membership.allianceId))
        .orderBy(asc(allianceMembers.joinedAt));

      return { ...alliance, myRole: membership.role, members };
    },

    async myInvitations(userId: string) {
      return db
        .select({
          id: allianceInvitations.id,
          allianceName: alliances.name,
          allianceTag: alliances.tag,
          invitedByUsername: users.username,
          createdAt: allianceInvitations.createdAt,
        })
        .from(allianceInvitations)
        .innerJoin(alliances, eq(alliances.id, allianceInvitations.allianceId))
        .innerJoin(users, eq(users.id, allianceInvitations.invitedByUserId))
        .where(and(eq(allianceInvitations.invitedUserId, userId), eq(allianceInvitations.status, 'pending')));
    },

    async applications(userId: string) {
      const membership = await requireRole(db, userId, ['founder', 'officer']);

      return db
        .select({
          id: allianceApplications.id,
          applicantUsername: users.username,
          createdAt: allianceApplications.createdAt,
        })
        .from(allianceApplications)
        .innerJoin(users, eq(users.id, allianceApplications.applicantUserId))
        .where(and(eq(allianceApplications.allianceId, membership.allianceId), eq(allianceApplications.status, 'pending')));
    },

    async ranking(page: number = 1) {
      const limit = 20;
      const offset = (page - 1) * limit;

      return db
        .select({
          allianceId: alliances.id,
          name: alliances.name,
          tag: alliances.tag,
          memberCount: sql<number>`count(${allianceMembers.userId})::int`,
          totalPoints: sql<number>`coalesce(sum(${rankings.totalPoints}), 0)::int`,
        })
        .from(alliances)
        .innerJoin(allianceMembers, eq(allianceMembers.allianceId, alliances.id))
        .leftJoin(rankings, eq(rankings.userId, allianceMembers.userId))
        .groupBy(alliances.id, alliances.name, alliances.tag)
        .orderBy(desc(sql`coalesce(sum(${rankings.totalPoints}), 0)`))
        .limit(limit)
        .offset(offset);
    },

    async search(query: string) {
      return db
        .select({
          id: alliances.id,
          name: alliances.name,
          tag: alliances.tag,
          memberCount: sql<number>`count(${allianceMembers.userId})::int`,
        })
        .from(alliances)
        .innerJoin(allianceMembers, eq(allianceMembers.allianceId, alliances.id))
        .where(or(ilike(alliances.name, `%${query}%`), ilike(alliances.tag, `%${query}%`)))
        .groupBy(alliances.id, alliances.name, alliances.tag)
        .limit(20);
    },
  };
}
```

- [ ] **Step 2: Commit service**

```bash
git add apps/api/src/modules/alliance/alliance.service.ts
git commit -m "feat(api): create alliance service with full business logic"
```

### Task 3: Create alliance router + wire + update message types

**Files:**
- Create: `apps/api/src/modules/alliance/alliance.router.ts`
- Modify: `apps/api/src/trpc/app-router.ts`
- Modify: `apps/api/src/modules/message/message.service.ts:39-40`
- Modify: `apps/api/src/modules/message/message.service.ts:59`
- Modify: `apps/api/src/modules/message/message.router.ts:11`

- [ ] **Step 1: Create alliance router**

Create `apps/api/src/modules/alliance/alliance.router.ts`:

```typescript
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
```

- [ ] **Step 2: Update message service type signatures**

In `apps/api/src/modules/message/message.service.ts`, change the `createSystemMessage` type parameter (line 39):

From: `type: 'system' | 'colonization' | 'espionage' | 'combat'`
To: `type: 'system' | 'colonization' | 'espionage' | 'combat' | 'alliance'`

And update `listMessages` options type (line 59):

From: `type?: 'system' | 'colonization' | 'player' | 'espionage' | 'combat'`
To: `type?: 'system' | 'colonization' | 'player' | 'espionage' | 'combat' | 'alliance'`

- [ ] **Step 3: Update message router z.enum**

In `apps/api/src/modules/message/message.router.ts:11`, change:

From: `z.enum(['system', 'player', 'combat', 'espionage', 'colonization'])`
To: `z.enum(['system', 'player', 'combat', 'espionage', 'colonization', 'alliance'])`

- [ ] **Step 4: Wire alliance in app-router**

In `apps/api/src/trpc/app-router.ts`, add imports:

```typescript
import { createAllianceService } from '../modules/alliance/alliance.service.js';
import { createAllianceRouter } from '../modules/alliance/alliance.router.js';
```

After `const rankingService = ...` add:
```typescript
const allianceService = createAllianceService(db, messageService);
```

After `const rankingRouter = ...` add:
```typescript
const allianceRouter = createAllianceRouter(allianceService);
```

In the router object, after `ranking: rankingRouter,` add:
```typescript
alliance: allianceRouter,
```

- [ ] **Step 5: Update galaxy service to include alliance tags**

In `apps/api/src/modules/galaxy/galaxy.service.ts`, add imports:

```typescript
import { eq, and } from 'drizzle-orm';
import { planets, users, debrisFields, allianceMembers, alliances } from '@ogame-clone/db';
```

Replace the existing query (lines 8-19) to left join alliance data:

```typescript
const systemPlanets = await db
  .select({
    position: planets.position,
    planetId: planets.id,
    planetName: planets.name,
    planetType: planets.planetType,
    userId: planets.userId,
    username: users.username,
    allianceTag: alliances.tag,
  })
  .from(planets)
  .leftJoin(users, eq(users.id, planets.userId))
  .leftJoin(allianceMembers, eq(allianceMembers.userId, planets.userId))
  .leftJoin(alliances, eq(alliances.id, allianceMembers.allianceId))
  .where(and(eq(planets.galaxy, galaxy), eq(planets.system, system)));
```

- [ ] **Step 6: Typecheck**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && pnpm turbo typecheck --filter=@ogame-clone/api`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/alliance/ apps/api/src/trpc/app-router.ts apps/api/src/modules/message/ apps/api/src/modules/galaxy/galaxy.service.ts
git commit -m "feat(api): add alliance router, wire module, update message types and galaxy service"
```

---

## Chunk 3: Frontend

### Task 4: Add Alliance page

**Files:**
- Create: `apps/web/src/pages/Alliance.tsx`

- [ ] **Step 1: Create the Alliance page**

Create `apps/web/src/pages/Alliance.tsx` — full page with conditional rendering based on membership state:

```typescript
import { useState } from 'react';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Alliance() {
  const utils = trpc.useUtils();
  const { data: myAlliance, isLoading } = trpc.alliance.myAlliance.useQuery();
  const { data: invitations } = trpc.alliance.myInvitations.useQuery();

  if (isLoading) return <div className="p-6 text-muted-foreground">Chargement...</div>;

  if (!myAlliance) return <NoAllianceView invitations={invitations ?? []} />;
  return <AllianceView alliance={myAlliance} />;
}

function NoAllianceView({ invitations }: { invitations: any[] }) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const createMutation = trpc.alliance.create.useMutation({
    onSuccess: () => { utils.alliance.myAlliance.invalidate(); },
  });

  const { data: searchResults } = trpc.alliance.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 },
  );

  const applyMutation = trpc.alliance.apply.useMutation({
    onSuccess: () => { utils.alliance.myAlliance.invalidate(); },
  });

  const respondMutation = trpc.alliance.respondInvitation.useMutation({
    onSuccess: () => {
      utils.alliance.myAlliance.invalidate();
      utils.alliance.myInvitations.invalidate();
    },
  });

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Alliance</h1>

      <div className="flex gap-2">
        <Button variant={tab === 'create' ? 'default' : 'outline'} size="sm" onClick={() => setTab('create')}>Créer</Button>
        <Button variant={tab === 'join' ? 'default' : 'outline'} size="sm" onClick={() => setTab('join')}>Rejoindre</Button>
      </div>

      {tab === 'create' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Créer une alliance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nom (3-30 caractères)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'alliance" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tag (2-8 caractères)</label>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="TAG" />
            </div>
            {createMutation.error && <p className="text-sm text-destructive">{createMutation.error.message}</p>}
            <Button onClick={() => createMutation.mutate({ name, tag })} disabled={createMutation.isPending || name.length < 3 || tag.length < 2}>
              Créer
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'join' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Rechercher une alliance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Nom ou tag..." />
            {searchResults?.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-border/50 py-2">
                <span className="text-sm">[{a.tag}] {a.name} <span className="text-xs text-muted-foreground">({a.memberCount} membres)</span></span>
                <Button size="sm" variant="outline" onClick={() => applyMutation.mutate({ allianceId: a.id })} disabled={applyMutation.isPending}>
                  Postuler
                </Button>
              </div>
            ))}
            {applyMutation.error && <p className="text-sm text-destructive">{applyMutation.error.message}</p>}
          </CardContent>
        </Card>
      )}

      {invitations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Invitations reçues</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between border-b border-border/50 py-2">
                <span className="text-sm">[{inv.allianceTag}] {inv.allianceName} — invité par {inv.invitedByUsername}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondMutation.mutate({ invitationId: inv.id, accept: true })}>Accepter</Button>
                  <Button size="sm" variant="outline" onClick={() => respondMutation.mutate({ invitationId: inv.id, accept: false })}>Décliner</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AllianceView({ alliance }: { alliance: any }) {
  const utils = trpc.useUtils();
  const [inviteUsername, setInviteUsername] = useState('');
  const [circularSubject, setCircularSubject] = useState('');
  const [circularBody, setCircularBody] = useState('');
  const [description, setDescription] = useState(alliance.description ?? '');
  const [showApplications, setShowApplications] = useState(false);

  const { data: applications } = trpc.alliance.applications.useQuery(undefined, {
    enabled: showApplications && (alliance.myRole === 'founder' || alliance.myRole === 'officer'),
  });

  const invalidateAll = () => {
    utils.alliance.myAlliance.invalidate();
    utils.alliance.applications.invalidate();
  };

  const leaveMutation = trpc.alliance.leave.useMutation({ onSuccess: invalidateAll });
  const kickMutation = trpc.alliance.kick.useMutation({ onSuccess: invalidateAll });
  const setRoleMutation = trpc.alliance.setRole.useMutation({ onSuccess: invalidateAll });
  const inviteMutation = trpc.alliance.invite.useMutation({ onSuccess: () => setInviteUsername('') });
  const circularMutation = trpc.alliance.sendCircular.useMutation({ onSuccess: () => { setCircularSubject(''); setCircularBody(''); } });
  const updateMutation = trpc.alliance.update.useMutation({ onSuccess: invalidateAll });
  const respondAppMutation = trpc.alliance.respondApplication.useMutation({ onSuccess: invalidateAll });

  const isLeader = alliance.myRole === 'founder' || alliance.myRole === 'officer';
  const isFounder = alliance.myRole === 'founder';

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">[{alliance.tag}] {alliance.name}</h1>
        <Button variant="destructive" size="sm" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
          Quitter
        </Button>
      </div>

      {alliance.description && <p className="text-sm text-muted-foreground">{alliance.description}</p>}

      {/* Members */}
      <Card>
        <CardHeader><CardTitle className="text-base">Membres ({alliance.members.length})</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1">Joueur</th>
                <th className="px-2 py-1">Rôle</th>
                <th className="px-2 py-1">Depuis</th>
                {isLeader && <th className="px-2 py-1">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {alliance.members.map((m: any) => (
                <tr key={m.userId} className="border-b border-border/50">
                  <td className="px-2 py-1">{m.username}</td>
                  <td className="px-2 py-1 capitalize">{m.role}</td>
                  <td className="px-2 py-1 text-xs text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString('fr-FR')}</td>
                  {isLeader && (
                    <td className="px-2 py-1 flex gap-1">
                      {m.role !== 'founder' && isFounder && (
                        <Button size="sm" variant="outline" onClick={() => setRoleMutation.mutate({ userId: m.userId, role: m.role === 'officer' ? 'member' : 'officer' })}>
                          {m.role === 'officer' ? 'Rétrograder' : 'Promouvoir'}
                        </Button>
                      )}
                      {m.role !== 'founder' && !(m.role === 'officer' && !isFounder) && (
                        <Button size="sm" variant="destructive" onClick={() => kickMutation.mutate({ userId: m.userId })}>
                          Expulser
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Leader actions */}
      {isLeader && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Inviter un joueur</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="Nom du joueur" className="w-60" />
              <Button onClick={() => inviteMutation.mutate({ username: inviteUsername })} disabled={inviteMutation.isPending || !inviteUsername}>
                Inviter
              </Button>
              {inviteMutation.error && <span className="text-sm text-destructive self-center">{inviteMutation.error.message}</span>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Message circulaire</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input value={circularSubject} onChange={(e) => setCircularSubject(e.target.value)} placeholder="Sujet" />
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={circularBody} onChange={(e) => setCircularBody(e.target.value)} placeholder="Message..." />
              <Button onClick={() => circularMutation.mutate({ subject: circularSubject, body: circularBody })} disabled={circularMutation.isPending || !circularSubject || !circularBody}>
                Envoyer à tous
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Candidatures</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowApplications(!showApplications)}>
                  {showApplications ? 'Masquer' : 'Afficher'}
                </Button>
              </div>
            </CardHeader>
            {showApplications && (
              <CardContent className="space-y-2">
                {(!applications || applications.length === 0) ? (
                  <p className="text-sm text-muted-foreground">Aucune candidature en attente.</p>
                ) : (
                  applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between border-b border-border/50 py-2">
                      <span className="text-sm">{app.applicantUsername}</span>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => respondAppMutation.mutate({ applicationId: app.id, accept: true })}>Accepter</Button>
                        <Button size="sm" variant="outline" onClick={() => respondAppMutation.mutate({ applicationId: app.id, accept: false })}>Décliner</Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              <Button onClick={() => updateMutation.mutate({ description })} disabled={updateMutation.isPending}>
                Mettre à jour
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Alliance.tsx
git commit -m "feat(web): create Alliance page with create/join/manage views"
```

### Task 5: Add AllianceRanking page + routing + sidebar + Galaxy/Messages updates

**Files:**
- Create: `apps/web/src/pages/AllianceRanking.tsx`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Modify: `apps/web/src/pages/Galaxy.tsx`
- Modify: `apps/web/src/pages/Messages.tsx`

- [ ] **Step 1: Create AllianceRanking page**

Create `apps/web/src/pages/AllianceRanking.tsx`:

```typescript
import { useState } from 'react';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AllianceRanking() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: rankings, isLoading } = trpc.alliance.ranking.useQuery({ page });

  if (isLoading) return <div className="p-6 text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Classement des alliances</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Classement</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1 w-16">Rang</th>
                <th className="px-2 py-1">Alliance</th>
                <th className="px-2 py-1 text-right">Membres</th>
                <th className="px-2 py-1 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rankings?.map((entry, i) => (
                <tr key={entry.allianceId} className="border-b border-border/50">
                  <td className="px-2 py-1 font-mono">{(page - 1) * limit + i + 1}</td>
                  <td className="px-2 py-1">[{entry.tag}] {entry.name}</td>
                  <td className="px-2 py-1 text-right">{entry.memberCount}</td>
                  <td className="px-2 py-1 text-right">{entry.totalPoints.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {(!rankings || rankings.length === 0) && (
                <tr><td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">Aucune alliance.</td></tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Précédent</Button>
            <span className="text-sm text-muted-foreground self-center">Page {page}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!rankings || rankings.length < limit}>Suivant</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add routes**

In `apps/web/src/router.tsx`, add after the `ranking` route:

```typescript
{
  path: 'alliance',
  lazy: () => import('./pages/Alliance').then((m) => ({ Component: m.default })),
},
{
  path: 'alliance-ranking',
  lazy: () => import('./pages/AllianceRanking').then((m) => ({ Component: m.default })),
},
```

- [ ] **Step 3: Add sidebar links**

In `apps/web/src/components/layout/Sidebar.tsx`, add to `navItems` array after the ranking entry:

```typescript
{ label: 'Alliance', path: '/alliance', icon: '🤝' },
{ label: 'Classement Alliances', path: '/alliance-ranking', icon: '🏅' },
```

- [ ] **Step 4: Update Galaxy.tsx to show alliance tags**

In `apps/web/src/pages/Galaxy.tsx`, update the username cell to show alliance tag. Find the line:

```tsx
<td className="px-2 py-1">
  {slot.username}
```

Replace with:

```tsx
<td className="px-2 py-1">
  {(slot as any).allianceTag && <span className="text-xs text-primary mr-1">[{(slot as any).allianceTag}]</span>}
  {slot.username}
```

- [ ] **Step 5: Add Alliance filter to Messages.tsx**

In `apps/web/src/pages/Messages.tsx`, add `{ label: 'Alliance', value: 'alliance' }` to the filter array, after the colonization entry.

- [ ] **Step 6: Typecheck**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && pnpm turbo typecheck`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/AllianceRanking.tsx apps/web/src/router.tsx apps/web/src/components/layout/Sidebar.tsx apps/web/src/pages/Galaxy.tsx apps/web/src/pages/Messages.tsx
git commit -m "feat(web): add alliance ranking, routing, sidebar links, galaxy tags, message filter"
```

---

## Chunk 4: Verification

### Task 6: Full verification

- [ ] **Step 1: Typecheck** — `pnpm turbo typecheck`
- [ ] **Step 2: Lint** — `pnpm turbo lint`
- [ ] **Step 3: Tests** — `pnpm turbo test`
- [ ] **Step 4: Fix any issues**
