# Game Events, Notifications & History — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent game events with browser notifications, notification center (bell dropdown), recent events on Overview, and a full History page.

**Architecture:** Single `game_events` DB table populated by workers at completion. tRPC `gameEvent` module exposes queries. SSE extended for fleet events. Frontend adds bell dropdown, browser Notification API, `(N)` document title, Overview events section, and History page.

**Tech Stack:** Drizzle ORM, tRPC 11, React 19, Zustand, BullMQ, Redis pub/sub, SSE, Notification API.

**Spec:** `docs/superpowers/specs/2026-03-16-game-events-notifications-design.md`

---

## Chunk 1: Backend — Schema, Service, Router, Workers

### Task 1: Create `game_events` Drizzle schema

**Files:**
- Create: `packages/db/src/schema/game-events.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the schema file**

```typescript
// packages/db/src/schema/game-events.ts
import { pgTable, uuid, text, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { planets } from './planets.js';

export const gameEvents = pgTable('game_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planetId: uuid('planet_id').references(() => planets.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('game_events_user_read_date_idx').on(table.userId, table.read, table.createdAt),
  index('game_events_planet_date_idx').on(table.planetId, table.createdAt),
]);
```

- [ ] **Step 2: Export from schema index**

Add to `packages/db/src/schema/index.ts`:
```typescript
export * from './game-events.js';
```

- [ ] **Step 3: Push schema to DB**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm --filter @exilium/db db:push`
Expected: table `game_events` created with indexes.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/game-events.ts packages/db/src/schema/index.ts
git commit -m "feat: add game_events schema table"
```

---

### Task 2: Create `gameEvent` service

**Files:**
- Create: `apps/api/src/modules/game-event/game-event.service.ts`

- [ ] **Step 1: Create the service**

Note: The project uses postgres-js driver where `db.update().set().where()` does NOT have `.rowCount`. Use `.returning()` to count affected rows.

```typescript
// apps/api/src/modules/game-event/game-event.service.ts
import { eq, and, desc, lt, sql, inArray } from 'drizzle-orm';
import { gameEvents } from '@exilium/db';
import type { Database } from '@exilium/db';

export type GameEventType = 'building-done' | 'research-done' | 'shipyard-done' | 'fleet-arrived' | 'fleet-returned';

export function createGameEventService(db: Database) {
  return {
    async insert(userId: string, planetId: string | null, type: GameEventType, payload: Record<string, unknown>) {
      await db.insert(gameEvents).values({ userId, planetId, type, payload });
    },

    async getRecent(userId: string, limit = 10) {
      return db
        .select()
        .from(gameEvents)
        .where(eq(gameEvents.userId, userId))
        .orderBy(desc(gameEvents.createdAt))
        .limit(limit);
    },

    async getUnreadCount(userId: string) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(gameEvents)
        .where(and(eq(gameEvents.userId, userId), eq(gameEvents.read, false)));
      return result?.count ?? 0;
    },

    async markAllRead(userId: string) {
      const rows = await db
        .update(gameEvents)
        .set({ read: true })
        .where(and(eq(gameEvents.userId, userId), eq(gameEvents.read, false)))
        .returning({ id: gameEvents.id });
      return rows.length;
    },

    async getByPlanet(userId: string, planetId: string, limit = 10) {
      return db
        .select()
        .from(gameEvents)
        .where(and(eq(gameEvents.userId, userId), eq(gameEvents.planetId, planetId)))
        .orderBy(desc(gameEvents.createdAt))
        .limit(limit);
    },

    async getHistory(userId: string, options: { cursor?: string; limit?: number; types?: GameEventType[] }) {
      const limit = options.limit ?? 20;
      const conditions = [eq(gameEvents.userId, userId)];

      if (options.cursor) {
        const [cursorEvent] = await db
          .select({ createdAt: gameEvents.createdAt })
          .from(gameEvents)
          .where(eq(gameEvents.id, options.cursor))
          .limit(1);
        if (cursorEvent) {
          conditions.push(lt(gameEvents.createdAt, cursorEvent.createdAt));
        }
      }

      if (options.types && options.types.length > 0) {
        conditions.push(inArray(gameEvents.type, options.types));
      }

      const events = await db
        .select()
        .from(gameEvents)
        .where(and(...conditions))
        .orderBy(desc(gameEvents.createdAt))
        .limit(limit + 1);

      const hasMore = events.length > limit;
      const results = hasMore ? events.slice(0, limit) : events;
      const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

      return { events: results, nextCursor };
    },

    async cleanup(retentionDays = 30) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);
      const rows = await db
        .delete(gameEvents)
        .where(lt(gameEvents.createdAt, cutoff))
        .returning({ id: gameEvents.id });
      return rows.length;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/game-event/game-event.service.ts
git commit -m "feat: add gameEvent service with CRUD operations"
```

---

### Task 3: Create `gameEvent` tRPC router

**Files:**
- Create: `apps/api/src/modules/game-event/game-event.router.ts`
- Modify: `apps/api/src/trpc/app-router.ts`

- [ ] **Step 1: Create the router**

Note: `byPlanet` includes `ctx.userId!` in the service call to prevent information disclosure (a user querying another player's planet events).

```typescript
// apps/api/src/modules/game-event/game-event.router.ts
import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import type { createGameEventService } from './game-event.service.js';

const gameEventTypeEnum = z.enum(['building-done', 'research-done', 'shipyard-done', 'fleet-arrived', 'fleet-returned']);

export function createGameEventRouter(gameEventService: ReturnType<typeof createGameEventService>) {
  return router({
    recent: protectedProcedure
      .query(async ({ ctx }) => {
        return gameEventService.getRecent(ctx.userId!);
      }),

    unreadCount: protectedProcedure
      .query(async ({ ctx }) => {
        const count = await gameEventService.getUnreadCount(ctx.userId!);
        return { count };
      }),

    markAllRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        const updated = await gameEventService.markAllRead(ctx.userId!);
        return { updated };
      }),

    byPlanet: protectedProcedure
      .input(z.object({ planetId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        return gameEventService.getByPlanet(ctx.userId!, input.planetId);
      }),

    history: protectedProcedure
      .input(z.object({
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        types: z.array(gameEventTypeEnum).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return gameEventService.getHistory(ctx.userId!, {
          cursor: input?.cursor,
          limit: input?.limit,
          types: input?.types,
        });
      }),
  });
}
```

- [ ] **Step 2: Register in app-router.ts**

In `apps/api/src/trpc/app-router.ts`, add imports and wire the router:

Add imports at top:
```typescript
import { createGameEventService } from '../modules/game-event/game-event.service.js';
import { createGameEventRouter } from '../modules/game-event/game-event.router.js';
```

In `buildAppRouter()`, after `const playerAdminService = ...`:
```typescript
const gameEventService = createGameEventService(db);
```

After `const playerAdminRouter = ...`:
```typescript
const gameEventRouter = createGameEventRouter(gameEventService);
```

In the `return router({` block, add:
```typescript
gameEvent: gameEventRouter,
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/game-event/game-event.router.ts apps/api/src/trpc/app-router.ts
git commit -m "feat: add gameEvent tRPC router with 5 procedures"
```

---

### Task 4: Extend SSE notification types for fleet events

**Files:**
- Modify: `apps/api/src/modules/notification/notification.publisher.ts`

- [ ] **Step 1: Add fleet types to NotificationEvent**

Replace line 4 of `notification.publisher.ts`:
```typescript
// Old:
type: 'new-message' | 'building-done' | 'research-done' | 'shipyard-done';
// New:
type: 'new-message' | 'building-done' | 'research-done' | 'shipyard-done' | 'fleet-arrived' | 'fleet-returned';
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/notification/notification.publisher.ts
git commit -m "feat: extend SSE notification types with fleet-arrived/fleet-returned"
```

---

### Task 5: Enrich fleet service return values

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.service.ts`

**IMPORTANT:** This task MUST be done BEFORE Task 6 (worker modifications) because the fleet workers depend on the enriched return values.

The `processArrival` and `processReturn` methods must return enriched objects with `userId`, `originPlanetId`, `originName`, `targetCoords`, `ships`, `cargo`.

- [ ] **Step 1: Enrich processArrival return values**

In `fleet.service.ts`, the `processArrival` method (line 276) already has access to `event`. After the cargo variable declarations (after line 288: `const hydrogeneCargo = ...`), fetch the origin planet name and build eventMeta:

```typescript
      const [originPlanet] = await db
        .select({ name: planets.name })
        .from(planets)
        .where(eq(planets.id, event.originPlanetId))
        .limit(1);

      const eventMeta = {
        userId: event.userId,
        originPlanetId: event.originPlanetId,
        originName: originPlanet?.name ?? 'Planète',
        targetCoords: `${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}`,
        ships,
        cargo: { minerai: mineraiCargo, silicium: siliciumCargo, hydrogene: hydrogeneCargo },
      };
```

Then modify EVERY return in processArrival (including returns from delegated sub-methods) by wrapping the delegation calls:
- `return { mission: 'transport', delivered: true };` → `return { ...eventMeta, mission: 'transport', delivered: true };`
- `return { mission: 'station', stationed: true };` → `return { ...eventMeta, mission: 'station', stationed: true };`
- `return { mission: event.mission, placeholder: true };` → `return { ...eventMeta, mission: event.mission, placeholder: true };`
- For delegated calls: `return this.processColonize(...)` → `return { ...eventMeta, ...(await this.processColonize(...)) };`
- Same for `processSpy`, `processAttack`, `processRecycle` delegations.

This ensures ALL mission types (transport, station, colonize, spy, attack, recycle) include the enriched metadata.

- [ ] **Step 2: Enrich processReturn return values**

In `processReturn` (line 386), after the `if (!event) return null;` check and after `const ships = ...` (line 401), add:

```typescript
      const [originPlanet] = await db
        .select({ name: planets.name })
        .from(planets)
        .where(eq(planets.id, event.originPlanetId))
        .limit(1);
```

Modify the return at the end (currently `return { returned: true, ships };`) to:
```typescript
      return {
        returned: true,
        ships,
        userId: event.userId,
        originPlanetId: event.originPlanetId,
        originName: originPlanet?.name ?? 'Planète',
        targetCoords: `${event.targetGalaxy}:${event.targetSystem}:${event.targetPosition}`,
        mission: event.mission,
        cargo: {
          minerai: Number(event.mineraiCargo),
          silicium: Number(event.siliciumCargo),
          hydrogene: Number(event.hydrogeneCargo),
        },
      };
```

Note: `processReturn` already fetches the origin planet further down (for cargo deposit), but the name fetch is at the top to avoid duplicating it conditionally.

- [ ] **Step 3: Verify build**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm build`
Expected: successful build with no TS errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.service.ts
git commit -m "feat: enrich fleet processArrival/processReturn return values for notifications"
```

---

### Task 6: Modify workers to insert game events

**Files:**
- Modify: `apps/api/src/workers/building-completion.worker.ts`
- Modify: `apps/api/src/workers/research-completion.worker.ts`
- Modify: `apps/api/src/workers/shipyard-completion.worker.ts`
- Modify: `apps/api/src/workers/fleet-arrival.worker.ts`
- Modify: `apps/api/src/workers/fleet-return.worker.ts`

Each worker needs:
1. Import `gameEvents` (and `planets` where needed) from `@exilium/db`
2. Insert a `game_events` row alongside the existing `publishNotification`

- [ ] **Step 1: Modify building-completion.worker.ts**

Add import at top:
```typescript
import { gameEvents, planets } from '@exilium/db';
```

After the `publishNotification` call (inside the `if (entry)` block, after line 39), add:
```typescript
          // Fetch planet name for event payload
          const [planet] = await db
            .select({ name: planets.name })
            .from(planets)
            .where(eq(planets.id, entry.planetId))
            .limit(1);

          await db.insert(gameEvents).values({
            userId: entry.userId,
            planetId: entry.planetId,
            type: 'building-done',
            payload: { buildingId: result.buildingId, level: result.newLevel, planetName: planet?.name ?? 'Planète' },
          });
```

- [ ] **Step 2: Modify research-completion.worker.ts**

Add import at top:
```typescript
import { gameEvents, planets } from '@exilium/db';
```

The research worker currently only selects `userId` from `buildQueue`. Also select `planetId`:
```typescript
// Replace:
.select({ userId: buildQueue.userId })
// With:
.select({ userId: buildQueue.userId, planetId: buildQueue.planetId })
```

After the `publishNotification` call (inside the `if (entry)` block), add:
```typescript
          // Fetch planet name for event payload
          const [planet] = await db
            .select({ name: planets.name })
            .from(planets)
            .where(eq(planets.id, entry.planetId))
            .limit(1);

          await db.insert(gameEvents).values({
            userId: entry.userId,
            planetId: entry.planetId,
            type: 'research-done',
            payload: { techId: result.researchId, level: result.newLevel, planetName: planet?.name ?? 'Planète' },
          });
```

- [ ] **Step 3: Modify shipyard-completion.worker.ts**

Add import at top:
```typescript
import { gameEvents, planets } from '@exilium/db';
```

After the `publishNotification` call (inside the `if (entry && result.completed)` block), add:
```typescript
          const [planet] = await db
            .select({ name: planets.name })
            .from(planets)
            .where(eq(planets.id, entry.planetId))
            .limit(1);

          await db.insert(gameEvents).values({
            userId: entry.userId,
            planetId: entry.planetId,
            type: 'shipyard-done',
            payload: { unitId: result.itemId, count: result.totalCompleted, planetName: planet?.name ?? 'Planète' },
          });
```

- [ ] **Step 4: Modify fleet-arrival.worker.ts**

This worker needs significant changes: add Redis, publishNotification, and game event insert. Replace the entire file:

```typescript
// apps/api/src/workers/fleet-arrival.worker.ts
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createDb, gameEvents } from '@exilium/db';
import { createResourceService } from '../modules/resource/resource.service.js';
import { createFleetService } from '../modules/fleet/fleet.service.js';
import { createGameConfigService } from '../modules/admin/game-config.service.js';
import { fleetArrivalQueue, fleetReturnQueue } from '../queues/queue.js';
import { publishNotification } from '../modules/notification/notification.publisher.js';
import { env } from '../config/env.js';
import { UNIVERSE_CONFIG } from '../modules/universe/universe.config.js';

export function startFleetArrivalWorker(db: ReturnType<typeof createDb>) {
  const resourceService = createResourceService(db);
  const gameConfigService = createGameConfigService(db);
  const fleetService = createFleetService(db, resourceService, fleetArrivalQueue, fleetReturnQueue, UNIVERSE_CONFIG.speed, undefined, gameConfigService);
  const redis = new Redis(env.REDIS_URL);

  const worker = new Worker(
    'fleet-arrival',
    async (job) => {
      const { fleetEventId } = job.data as { fleetEventId: string };
      console.log(`[fleet-arrival] Processing job ${job.id}`);
      const result = await fleetService.processArrival(fleetEventId);
      if (result) {
        console.log(`[fleet-arrival] Mission ${result.mission} processed`);

        if (result.userId) {
          publishNotification(redis, result.userId, {
            type: 'fleet-arrived',
            payload: {
              mission: result.mission,
              originName: result.originName,
              targetCoords: result.targetCoords,
            },
          });

          await db.insert(gameEvents).values({
            userId: result.userId,
            planetId: result.originPlanetId,
            type: 'fleet-arrived',
            payload: {
              mission: result.mission,
              originName: result.originName,
              targetCoords: result.targetCoords,
              ships: result.ships,
              cargo: result.cargo,
            },
          });
        }
      }
    },
    { connection: { url: env.REDIS_URL }, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[fleet-arrival] Job ${job?.id} failed:`, err);
  });

  return worker;
}
```

- [ ] **Step 5: Modify fleet-return.worker.ts**

Same pattern. Replace the entire file:

```typescript
// apps/api/src/workers/fleet-return.worker.ts
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createDb, gameEvents } from '@exilium/db';
import { createResourceService } from '../modules/resource/resource.service.js';
import { createFleetService } from '../modules/fleet/fleet.service.js';
import { createGameConfigService } from '../modules/admin/game-config.service.js';
import { fleetArrivalQueue, fleetReturnQueue } from '../queues/queue.js';
import { publishNotification } from '../modules/notification/notification.publisher.js';
import { env } from '../config/env.js';
import { UNIVERSE_CONFIG } from '../modules/universe/universe.config.js';

export function startFleetReturnWorker(db: ReturnType<typeof createDb>) {
  const resourceService = createResourceService(db);
  const gameConfigService = createGameConfigService(db);
  const fleetService = createFleetService(db, resourceService, fleetArrivalQueue, fleetReturnQueue, UNIVERSE_CONFIG.speed, undefined, gameConfigService);
  const redis = new Redis(env.REDIS_URL);

  const worker = new Worker(
    'fleet-return',
    async (job) => {
      const { fleetEventId } = job.data as { fleetEventId: string };
      console.log(`[fleet-return] Processing job ${job.id}`);
      const result = await fleetService.processReturn(fleetEventId);
      if (result) {
        console.log(`[fleet-return] Fleet returned with ${Object.keys(result.ships).length} ship types`);

        if (result.userId) {
          publishNotification(redis, result.userId, {
            type: 'fleet-returned',
            payload: {
              mission: result.mission,
              originName: result.originName,
              targetCoords: result.targetCoords,
            },
          });

          await db.insert(gameEvents).values({
            userId: result.userId,
            planetId: result.originPlanetId,
            type: 'fleet-returned',
            payload: {
              mission: result.mission,
              originName: result.originName,
              targetCoords: result.targetCoords,
              ships: result.ships,
              cargo: result.cargo,
            },
          });
        }
      }
    },
    { connection: { url: env.REDIS_URL }, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[fleet-return] Job ${job?.id} failed:`, err);
  });

  return worker;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/workers/
git commit -m "feat: workers insert game_events + fleet workers emit SSE notifications"
```

---

### Task 7: Add event cleanup cron

**Files:**
- Create: `apps/api/src/cron/event-cleanup.ts`
- Modify: `apps/api/src/workers/worker.ts`

- [ ] **Step 1: Create the cron file**

Uses `createGameEventService` to avoid duplicating cleanup logic.

```typescript
// apps/api/src/cron/event-cleanup.ts
import type { Database } from '@exilium/db';
import { createGameEventService } from '../modules/game-event/game-event.service.js';

export async function eventCleanup(db: Database) {
  const service = createGameEventService(db);
  const count = await service.cleanup();
  if (count > 0) {
    console.log(`[event-cleanup] Deleted ${count} events older than 30 days`);
  }
}
```

- [ ] **Step 2: Register in worker.ts**

Add import:
```typescript
import { eventCleanup } from '../cron/event-cleanup.js';
```

Add after the ranking update cron block (after line 51):
```typescript
setInterval(async () => {
  try {
    await eventCleanup(db);
  } catch (err) {
    console.error('[event-cleanup] Error:', err);
  }
}, 24 * 60 * 60_000);
console.log('[worker] Event cleanup cron started (24h)');
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/cron/event-cleanup.ts apps/api/src/workers/worker.ts
git commit -m "feat: add daily game_events cleanup cron (30-day retention)"
```

---

## Chunk 2: Frontend — Notifications, Bell, Overview, History

### Task 8: Create shared game event helpers

**Files:**
- Create: `apps/web/src/lib/game-events.ts`

Shared helpers used by TopBar, Overview, and History. Avoids duplication.

- [ ] **Step 1: Create the utility file**

```typescript
// apps/web/src/lib/game-events.ts

export function eventTypeColor(type: string) {
  switch (type) {
    case 'building-done': return 'bg-primary';
    case 'research-done': return 'bg-violet-500';
    case 'shipyard-done': return 'bg-orange-500';
    case 'fleet-arrived': return 'bg-blue-500';
    case 'fleet-returned': return 'bg-emerald-500';
    default: return 'bg-muted';
  }
}

export function eventTypeLabel(type: string) {
  switch (type) {
    case 'building-done': return 'Construction';
    case 'research-done': return 'Recherche';
    case 'shipyard-done': return 'Chantier';
    case 'fleet-arrived': return 'Flotte arrivée';
    case 'fleet-returned': return 'Flotte de retour';
    default: return 'Événement';
  }
}

export function formatEventText(event: { type: string; payload: Record<string, unknown> }, options?: { includePlanet?: boolean }) {
  const p = event.payload as any;
  const planet = options?.includePlanet && p.planetName ? ` sur ${p.planetName}` : '';
  switch (event.type) {
    case 'building-done': return `${p.buildingId} niveau ${p.level}${planet}`;
    case 'research-done': return `${p.techId} niveau ${p.level}${planet}`;
    case 'shipyard-done': return `${p.count}x ${p.unitId}${planet}`;
    case 'fleet-arrived': return `Mission ${p.mission} arrivée en ${p.targetCoords}`;
    case 'fleet-returned': return `Flotte rentrée sur ${p.originName}`;
    default: return 'Événement';
  }
}

export function formatRelativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export function formatDateTime(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function eventNavigationTarget(type: string): string {
  switch (type) {
    case 'building-done': return '/buildings';
    case 'research-done': return '/research';
    case 'shipyard-done': return '/shipyard';
    case 'fleet-arrived':
    case 'fleet-returned': return '/movements';
    default: return '/';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/game-events.ts
git commit -m "feat: add shared game event helper utilities"
```

---

### Task 9: Update `useNotifications` — fleet events + browser notifications

**Files:**
- Modify: `apps/web/src/hooks/useNotifications.ts`

- [ ] **Step 1: Add fleet event cases + browser Notification API**

Replace the entire file:

```typescript
// apps/web/src/hooks/useNotifications.ts
import { useRef } from 'react';
import { useSSE } from './useSSE';
import { trpc } from '@/trpc';
import { useToastStore } from '@/stores/toast.store';

function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function useNotifications() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const permissionRequested = useRef(false);

  useSSE((event) => {
    // Request permission on first event
    if (!permissionRequested.current) {
      permissionRequested.current = true;
      requestNotificationPermission();
    }

    // Invalidate game event queries on any game event (not messages)
    if (event.type !== 'new-message') {
      utils.gameEvent.unreadCount.invalidate();
      utils.gameEvent.recent.invalidate();
      utils.gameEvent.byPlanet.invalidate();
    }

    switch (event.type) {
      case 'new-message':
        utils.message.inbox.invalidate();
        utils.message.unreadCount.invalidate();
        addToast(`Nouveau message : ${event.payload.subject}`);
        showBrowserNotification('Nouveau message', String(event.payload.subject));
        break;
      case 'building-done':
        utils.building.list.invalidate();
        utils.resource.production.invalidate();
        addToast(`Construction terminée : ${event.payload.buildingId} niv. ${event.payload.level}`);
        showBrowserNotification('Construction terminée', `${event.payload.buildingId} niveau ${event.payload.level}`);
        break;
      case 'research-done':
        utils.research.list.invalidate();
        addToast(`Recherche terminée : ${event.payload.techId} niv. ${event.payload.level}`);
        showBrowserNotification('Recherche terminée', `${event.payload.techId} niveau ${event.payload.level}`);
        break;
      case 'shipyard-done':
        utils.shipyard.queue.invalidate();
        utils.shipyard.ships.invalidate();
        utils.shipyard.defenses.invalidate();
        addToast(`Chantier terminé : ${event.payload.unitId} (x${event.payload.count})`);
        showBrowserNotification('Production terminée', `${event.payload.count}x ${event.payload.unitId}`);
        break;
      case 'fleet-arrived':
        utils.fleet.movements.invalidate();
        utils.resource.production.invalidate();
        addToast(`Flotte arrivée : mission ${event.payload.mission} en ${event.payload.targetCoords}`);
        showBrowserNotification('Flotte arrivée', `Mission ${event.payload.mission} en ${event.payload.targetCoords}`);
        break;
      case 'fleet-returned':
        utils.fleet.movements.invalidate();
        utils.resource.production.invalidate();
        addToast(`Flotte de retour sur ${event.payload.originName}`);
        showBrowserNotification('Flotte de retour', `Flotte rentrée sur ${event.payload.originName}`);
        break;
    }
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useNotifications.ts
git commit -m "feat: add browser notifications + fleet event handling in useNotifications"
```

---

### Task 10: Add `useDocumentTitle` hook

**Files:**
- Create: `apps/web/src/hooks/useDocumentTitle.ts`
- Modify: `apps/web/src/components/layout/Layout.tsx`

- [ ] **Step 1: Create the hook**

No `refetchInterval` needed — SSE already invalidates `unreadCount` on every event. The query will be up to date via cache invalidation.

```typescript
// apps/web/src/hooks/useDocumentTitle.ts
import { useEffect } from 'react';
import { trpc } from '@/trpc';

export function useDocumentTitle() {
  const { data } = trpc.gameEvent.unreadCount.useQuery();

  useEffect(() => {
    const count = data?.count ?? 0;
    document.title = count > 0 ? `(${count}) Exilium` : 'Exilium';
  }, [data?.count]);
}
```

- [ ] **Step 2: Add to Layout.tsx**

In `apps/web/src/components/layout/Layout.tsx`, add import:
```typescript
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
```

Inside the `Layout` function, after `useNotifications();` (line 27), add:
```typescript
  useDocumentTitle();
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useDocumentTitle.ts apps/web/src/components/layout/Layout.tsx
git commit -m "feat: dynamic document title with unread event count"
```

---

### Task 11: Add HistoryIcon to icons

**Files:**
- Modify: `apps/web/src/lib/icons.tsx`

- [ ] **Step 1: Add HistoryIcon**

Must use the `Icon` wrapper component like all other icons in the file.

Add at the end of `apps/web/src/lib/icons.tsx`:

```typescript
export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </Icon>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/icons.tsx
git commit -m "feat: add HistoryIcon SVG"
```

---

### Task 12: Refactor TopBar — bell dropdown for game events + separate message icon

**Files:**
- Modify: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Rewrite the notification/message section of TopBar**

Replace the entire `<div className="flex items-center gap-3">` block (lines 145-163) with the new implementation.

Add these imports at the top of the file:
```typescript
import { eventTypeColor, formatEventText, formatRelativeTime, eventNavigationTarget } from '@/lib/game-events';
```

Add new state and refs alongside existing ones (after line 38):
```typescript
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
```

Add game event queries (after the `unreadCount` query on line 44):
```typescript
  const { data: eventUnreadCount } = trpc.gameEvent.unreadCount.useQuery();
  const { data: recentEvents } = trpc.gameEvent.recent.useQuery();
  const markAllRead = trpc.gameEvent.markAllRead.useMutation({
    onSuccess: () => {
      utils.gameEvent.unreadCount.invalidate();
      utils.gameEvent.recent.invalidate();
    },
  });
```

Note: `utils` is already available — add `const utils = trpc.useUtils();` if not already present (it is not in the current TopBar, so add it).

Add click-outside handler for bell (after the existing dropdown click-outside useEffect):
```typescript
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    if (bellOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [bellOpen]);
```

Add handler for opening the bell:
```typescript
  const handleBellOpen = () => {
    setBellOpen(!bellOpen);
    if (!bellOpen) {
      markAllRead.mutate();
    }
  };
```

Replace lines 145-163 with:
```tsx
      <div className="flex items-center gap-2">
        {/* Messages (envelope) */}
        <button
          onClick={() => navigate('/messages')}
          className="relative rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Messages"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Notifications (bell) */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={handleBellOpen}
            className="relative rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Notifications"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {(eventUnreadCount?.count ?? 0) > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {eventUnreadCount!.count}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border border-white/10 bg-card/95 backdrop-blur-lg shadow-lg animate-slide-up">
              <div className="border-b border-border/30 px-3 py-2">
                <span className="text-xs font-semibold text-muted-foreground">Notifications</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {recentEvents && recentEvents.length > 0 ? (
                  recentEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => { navigate(eventNavigationTarget(event.type)); setBellOpen(false); }}
                      className={cn(
                        'flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                        !event.read && 'bg-primary/5 font-medium',
                      )}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${eventTypeColor(event.type)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{formatEventText(event)}</p>
                        <span className="text-xs text-muted-foreground/60">{formatRelativeTime(event.createdAt)}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">Aucune notification</p>
                )}
              </div>
              <div className="border-t border-border/30 px-3 py-2">
                <button
                  onClick={() => { navigate('/history'); setBellOpen(false); }}
                  className="text-xs text-primary hover:underline"
                >
                  Voir l'historique complet
                </button>
              </div>
            </div>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden lg:flex">
          Déconnexion
        </Button>
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/TopBar.tsx
git commit -m "feat: bell dropdown for game events + separate message icon in TopBar"
```

---

### Task 13: Add recent events section to Overview

**Files:**
- Modify: `apps/web/src/pages/Overview.tsx`

- [ ] **Step 1: Add game events query and section**

Add import at top:
```typescript
import { eventTypeColor, formatEventText, formatRelativeTime } from '@/lib/game-events';
```

Add a tRPC query alongside existing queries:
```typescript
const { data: recentEvents } = trpc.gameEvent.byPlanet.useQuery(
  { planetId: planetId! },
  { enabled: !!planetId },
);
```

Add a new section after the fleet movements section (after line 252) and before the production section. Note: the Overview uses a responsive grid, so add appropriate column span:

```tsx
{/* Recent events */}
<section className="glass-card p-4">
  <h2 className="text-sm font-semibold text-foreground mb-3">Événements récents</h2>
  {recentEvents && recentEvents.length > 0 ? (
    <div className="space-y-2">
      {recentEvents.map((event) => (
        <div key={event.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${eventTypeColor(event.type)}`} />
            <span className="text-muted-foreground">{formatEventText(event)}</span>
          </div>
          <span className="text-xs text-muted-foreground/60 shrink-0 ml-2">{formatRelativeTime(event.createdAt)}</span>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">Aucun événement récent</p>
  )}
</section>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Overview.tsx
git commit -m "feat: add recent events section to Overview page"
```

---

### Task 14: Create History page

**Files:**
- Create: `apps/web/src/pages/History.tsx`
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Create the History page**

Uses `useInfiniteQuery` pattern via tRPC for cursor-based pagination (avoids the manual state accumulation bugs). Note: tRPC v11 RC does not support `useInfiniteQuery` directly for this shape, so we use manual cursor management with proper deduplication.

```typescript
// apps/web/src/pages/History.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/trpc';
import { PageHeader } from '@/components/common/PageHeader';
import { eventTypeColor, eventTypeLabel, formatEventText, formatDateTime } from '@/lib/game-events';

const EVENT_TYPE_OPTIONS = [
  { value: 'building-done', label: 'Constructions' },
  { value: 'research-done', label: 'Recherches' },
  { value: 'shipyard-done', label: 'Chantier spatial' },
  { value: 'fleet-arrived', label: 'Flottes arrivées' },
  { value: 'fleet-returned', label: 'Flottes de retour' },
] as const;

type GameEventType = (typeof EVENT_TYPE_OPTIONS)[number]['value'];

export default function History() {
  const [selectedTypes, setSelectedTypes] = useState<GameEventType[]>([]);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const lastAppendedCursorRef = useRef<string | undefined>(undefined);

  const currentCursor = cursors[cursors.length - 1];

  const { data, isFetching } = trpc.gameEvent.history.useQuery(
    { cursor: currentCursor, limit: 20, types: selectedTypes.length > 0 ? selectedTypes : undefined },
    { placeholderData: (prev: any) => prev },
  );

  // Accumulate events from all pages
  const pages = useRef<Map<string | undefined, any[]>>(new Map());

  useEffect(() => {
    if (data && data.events.length > 0) {
      pages.current.set(currentCursor, data.events);
    }
  }, [data, currentCursor]);

  // Reset on filter change
  const handleFilterChange = (type: GameEventType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
    pages.current.clear();
    setCursors([undefined]);
    lastAppendedCursorRef.current = undefined;
  };

  // Load more
  const handleLoadMore = useCallback(() => {
    if (data?.nextCursor && !isFetching && lastAppendedCursorRef.current !== data.nextCursor) {
      lastAppendedCursorRef.current = data.nextCursor;
      setCursors((prev) => [...prev, data.nextCursor]);
    }
  }, [data?.nextCursor, isFetching]);

  // Infinite scroll observer
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMore(); },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  // Flatten all pages into a single list
  const allEvents = Array.from(pages.current.values()).flat();
  const hasMore = !!data?.nextCursor;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader title="Historique" />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {EVENT_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleFilterChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTypes.includes(opt.value)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div className="glass-card divide-y divide-border/30">
        {allEvents.length === 0 && !isFetching && (
          <p className="p-4 text-sm text-muted-foreground">Aucun événement</p>
        )}
        {allEvents.map((event) => (
          <div key={event.id} className="flex items-start gap-3 p-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${eventTypeColor(event.type)}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{eventTypeLabel(event.type)}</span>
              </div>
              <p className="text-sm">{formatEventText(event, { includePlanet: true })}</p>
            </div>
            <span className="text-xs text-muted-foreground/60 shrink-0">{formatDateTime(event.createdAt)}</span>
          </div>
        ))}
        {hasMore && (
          <div ref={loaderRef} className="flex justify-center p-4">
            {isFetching && <span className="text-xs text-muted-foreground">Chargement...</span>}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route in router.tsx**

In `apps/web/src/router.tsx`, add inside the children array (after the `alliance-ranking` route, before the closing `]`):

```typescript
      {
        path: 'history',
        lazy: () => import('./pages/History').then((m) => ({ Component: m.default })),
        errorElement: <ErrorBoundary><RouteErrorFallback /></ErrorBoundary>,
      },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/History.tsx apps/web/src/router.tsx
git commit -m "feat: add History page with infinite scroll and type filters"
```

---

### Task 15: Add History to navigation

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Modify: `apps/web/src/components/layout/BottomTabBar.tsx`

- [ ] **Step 1: Add to Sidebar**

In `apps/web/src/components/layout/Sidebar.tsx`, add import:
```typescript
import { HistoryIcon } from '@/lib/icons';
```

In the `sections` array, add to the 'Accueil' section items:
```typescript
{ label: 'Historique', path: '/history', icon: HistoryIcon },
```

- [ ] **Step 2: Add to BottomTabBar "Plus" sheet**

In `apps/web/src/components/layout/BottomTabBar.tsx`, add import:
```typescript
import { HistoryIcon } from '@/lib/icons';
```

In the `activeSheet === 'plus'` BottomSheet block, add before the logout button:

```tsx
<button
  onClick={() => handleSheetNav('/history')}
  className="flex items-center gap-3 rounded-lg p-3 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
>
  <HistoryIcon width={20} height={20} />
  <span className="text-sm font-medium">Historique</span>
</button>
```

Do NOT modify `TAB_GROUPS` — the "Accueil" tab stays as direct navigation to `/`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/Sidebar.tsx apps/web/src/components/layout/BottomTabBar.tsx
git commit -m "feat: add History page to sidebar and mobile navigation"
```

---

### Task 16: Build, verify, final commit

- [ ] **Step 1: Full build**

Run: `cd /Users/julienaubree/_projet/exilium && pnpm build`
Expected: successful build across all packages.

- [ ] **Step 2: Fix any type errors**

If build fails, fix TypeScript errors and re-run.

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```
