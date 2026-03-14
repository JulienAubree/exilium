# Phase 6c: Real-Time Notifications Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push real-time notifications (new messages, build/research/shipyard completions) from server to client via SSE, with toast feedback and unread badge in TopBar.

**Architecture:** Redis Pub/Sub bridges workers and API server. Fastify SSE endpoint streams events to the client via EventSource. Client hooks invalidate tRPC queries and display toasts.

**Tech Stack:** Fastify SSE endpoint, ioredis pub/sub, EventSource API, Zustand toast store

**Spec:** `docs/superpowers/specs/2026-03-14-phase6c-realtime-notifications.md`

---

## File Structure

**Create:**
- `apps/api/src/modules/notification/notification.publisher.ts` — `publishNotification(redis, userId, event)` utility
- `apps/api/src/modules/notification/notification.sse.ts` — Fastify `GET /sse` route with Redis subscriber per connection
- `apps/web/src/stores/toast.store.ts` — Zustand store for toast queue
- `apps/web/src/components/ui/Toaster.tsx` — Toast renderer (fixed bottom-right)
- `apps/web/src/hooks/useSSE.ts` — EventSource hook
- `apps/web/src/hooks/useNotifications.ts` — Event dispatcher (invalidations + toasts)

**Modify:**
- `apps/api/src/index.ts` — Register SSE route, create Redis instance
- `apps/api/src/trpc/app-router.ts` — Accept Redis param, pass to messageService
- `apps/api/src/modules/message/message.service.ts` — Accept Redis, publish on send/createSystem
- `apps/api/src/workers/building-completion.worker.ts` — Publish building-done
- `apps/api/src/workers/research-completion.worker.ts` — Publish research-done
- `apps/api/src/workers/shipyard-completion.worker.ts` — Publish shipyard-done
- `apps/web/vite.config.ts` — Add `/sse` proxy
- `apps/web/src/components/layout/Layout.tsx` — Mount useNotifications + Toaster
- `apps/web/src/components/layout/TopBar.tsx` — Add notification bell with unread badge

---

## Chunk 1: Server-side

### Task 1: Notification publisher + SSE endpoint

**Files:**
- Create: `apps/api/src/modules/notification/notification.publisher.ts`
- Create: `apps/api/src/modules/notification/notification.sse.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create notification publisher**

Create `apps/api/src/modules/notification/notification.publisher.ts`:

```typescript
import type Redis from 'ioredis';

export interface NotificationEvent {
  type: 'new-message' | 'building-done' | 'research-done' | 'shipyard-done';
  payload: Record<string, unknown>;
}

export function publishNotification(redis: Redis, userId: string, event: NotificationEvent) {
  return redis.publish(`notifications:${userId}`, JSON.stringify(event));
}
```

- [ ] **Step 2: Create SSE route**

Create `apps/api/src/modules/notification/notification.sse.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { jwtVerify } from 'jose';
import Redis from 'ioredis';

export function registerSSE(app: FastifyInstance, redisUrl: string, jwtSecret: Uint8Array) {
  app.get('/sse', async (req, reply) => {
    const token = (req.query as { token?: string }).token;
    if (!token) return reply.status(401).send({ error: 'Missing token' });

    let userId: string;
    try {
      const { payload } = await jwtVerify(token, jwtSecret);
      userId = payload.userId as string;
    } catch {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    reply.hijack();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const subscriber = new Redis(redisUrl);
    const channel = `notifications:${userId}`;
    await subscriber.subscribe(channel);

    subscriber.on('message', (_ch: string, message: string) => {
      reply.raw.write(`data: ${message}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(':ping\n\n');
    }, 30_000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      subscriber.unsubscribe(channel);
      subscriber.quit();
    });
  });
}
```

- [ ] **Step 3: Wire SSE route and Redis in index.ts**

Modify `apps/api/src/index.ts`. Add imports at top:

```typescript
import Redis from 'ioredis';
import { registerSSE } from './modules/notification/notification.sse.js';
```

After `const db = createDb(env.DATABASE_URL);`, add:

```typescript
const redis = new Redis(env.REDIS_URL);
const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
```

Change `buildAppRouter(db)` to `buildAppRouter(db, redis)`.

Before `server.listen`, add:

```typescript
registerSSE(server, env.REDIS_URL, JWT_SECRET);
```

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo typecheck --filter=@ogame-clone/api`
Expected: Fail on `buildAppRouter` signature mismatch (expected since Task 2 updates it)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notification/ apps/api/src/index.ts
git commit -m "feat(api): add notification publisher and SSE endpoint"
```

---

### Task 2: Wire Redis through app-router to message service

**Files:**
- Modify: `apps/api/src/trpc/app-router.ts`
- Modify: `apps/api/src/modules/message/message.service.ts`

- [ ] **Step 1: Update buildAppRouter to accept Redis**

In `apps/api/src/trpc/app-router.ts`:

Add import at top:

```typescript
import type Redis from 'ioredis';
```

Change function signature from:

```typescript
export function buildAppRouter(db: Database) {
```

to:

```typescript
export function buildAppRouter(db: Database, redis: Redis) {
```

Change `createMessageService(db)` to `createMessageService(db, redis)`.

- [ ] **Step 2: Update message service to accept Redis and publish notifications**

In `apps/api/src/modules/message/message.service.ts`:

Add imports:

```typescript
import type Redis from 'ioredis';
import { publishNotification } from '../notification/notification.publisher.js';
```

Change signature from `createMessageService(db: Database)` to `createMessageService(db: Database, redis: Redis)`.

In `sendMessage`, after `const [msg] = await db.insert(messages)...returning();`, add before `return msg;`:

```typescript
      // Fetch sender username for notification
      const [sender] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, senderId))
        .limit(1);

      publishNotification(redis, recipient.id, {
        type: 'new-message',
        payload: { messageId: msg.id, type: 'player', subject, senderUsername: sender?.username ?? null },
      });
```

In `createSystemMessage`, after `const [msg] = await db.insert(messages)...returning();`, add before `return msg;`:

```typescript
      publishNotification(redis, recipientId, {
        type: 'new-message',
        payload: { messageId: msg.id, type, subject, senderUsername: null },
      });
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo typecheck --filter=@ogame-clone/api`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/trpc/app-router.ts apps/api/src/modules/message/message.service.ts
git commit -m "feat(api): publish new-message notifications via Redis pub/sub"
```

---

### Task 3: Workers publish completion notifications

**Files:**
- Modify: `apps/api/src/workers/building-completion.worker.ts`
- Modify: `apps/api/src/workers/research-completion.worker.ts`
- Modify: `apps/api/src/workers/shipyard-completion.worker.ts`

- [ ] **Step 1: Update building-completion worker**

In `apps/api/src/workers/building-completion.worker.ts`, add imports:

```typescript
import Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { buildQueue } from '@ogame-clone/db';
import { publishNotification } from '../modules/notification/notification.publisher.js';
```

Inside `startBuildingCompletionWorker`, before `const worker = new Worker(...)`, add:

```typescript
  const redis = new Redis(env.REDIS_URL);
```

Inside the worker callback, after `const { buildQueueId } = job.data as { buildQueueId: string };`, add:

```typescript
      // Fetch entry for userId/planetId before completion
      const [entry] = await db
        .select({ userId: buildQueue.userId, planetId: buildQueue.planetId })
        .from(buildQueue)
        .where(eq(buildQueue.id, buildQueueId))
        .limit(1);
```

After `if (result) { console.log(...); }`, inside the `if (result)` block, add:

```typescript
        if (entry) {
          publishNotification(redis, entry.userId, {
            type: 'building-done',
            payload: { planetId: entry.planetId, buildingId: result.buildingId, level: result.newLevel },
          });
        }
```

- [ ] **Step 2: Update research-completion worker**

In `apps/api/src/workers/research-completion.worker.ts`, add same imports:

```typescript
import Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { buildQueue } from '@ogame-clone/db';
import { publishNotification } from '../modules/notification/notification.publisher.js';
```

Inside `startResearchCompletionWorker`, before `const worker = new Worker(...)`:

```typescript
  const redis = new Redis(env.REDIS_URL);
```

Inside the worker callback, after `const { buildQueueId } = job.data as { buildQueueId: string };`:

```typescript
      const [entry] = await db
        .select({ userId: buildQueue.userId })
        .from(buildQueue)
        .where(eq(buildQueue.id, buildQueueId))
        .limit(1);
```

After `if (result) { console.log(...); }`, inside the `if (result)` block:

```typescript
        if (entry) {
          publishNotification(redis, entry.userId, {
            type: 'research-done',
            payload: { techId: result.researchId, level: result.newLevel },
          });
        }
```

- [ ] **Step 3: Update shipyard-completion worker**

In `apps/api/src/workers/shipyard-completion.worker.ts`, add same imports:

```typescript
import Redis from 'ioredis';
import { eq } from 'drizzle-orm';
import { buildQueue } from '@ogame-clone/db';
import { publishNotification } from '../modules/notification/notification.publisher.js';
```

Inside `startShipyardCompletionWorker`, before `const worker = new Worker(...)`:

```typescript
  const redis = new Redis(env.REDIS_URL);
```

Inside the worker callback, after `const { buildQueueId } = job.data as { buildQueueId: string };`:

```typescript
      const [entry] = await db
        .select({ userId: buildQueue.userId, planetId: buildQueue.planetId })
        .from(buildQueue)
        .where(eq(buildQueue.id, buildQueueId))
        .limit(1);
```

After `if (result) { console.log(...); }`, inside the `if (result)` block, publish **only when batch is complete**:

```typescript
        if (entry && result.completed) {
          publishNotification(redis, entry.userId, {
            type: 'shipyard-done',
            payload: { planetId: entry.planetId, unitId: result.itemId, count: result.totalCompleted },
          });
        }
```

- [ ] **Step 4: Run typecheck**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo typecheck --filter=@ogame-clone/api`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workers/
git commit -m "feat(api): workers publish completion notifications via Redis pub/sub"
```

---

## Chunk 2: Client-side

### Task 4: Toast store + Toaster component

**Files:**
- Create: `apps/web/src/stores/toast.store.ts`
- Create: `apps/web/src/components/ui/Toaster.tsx`

- [ ] **Step 1: Create toast store**

Create `apps/web/src/stores/toast.store.ts`:

```typescript
import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
```

- [ ] **Step 2: Create Toaster component**

Create `apps/web/src/components/ui/Toaster.tsx`:

```tsx
import { useToastStore } from '@/stores/toast.store';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-in slide-in-from-right max-w-sm cursor-pointer rounded-md border border-border bg-card px-4 py-3 text-sm shadow-lg transition-opacity hover:opacity-80"
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo typecheck --filter=@ogame-clone/web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/stores/toast.store.ts apps/web/src/components/ui/Toaster.tsx
git commit -m "feat(web): add toast store and Toaster component"
```

---

### Task 5: SSE hook + notifications hook + Layout wiring

**Files:**
- Create: `apps/web/src/hooks/useSSE.ts`
- Create: `apps/web/src/hooks/useNotifications.ts`
- Modify: `apps/web/src/components/layout/Layout.tsx`
- Modify: `apps/web/vite.config.ts`

- [ ] **Step 1: Add SSE proxy to Vite config**

In `apps/web/vite.config.ts`, change the proxy section from:

```typescript
    proxy: {
      '/trpc': 'http://localhost:3000',
    },
```

to:

```typescript
    proxy: {
      '/trpc': 'http://localhost:3000',
      '/sse': 'http://localhost:3000',
    },
```

- [ ] **Step 2: Create useSSE hook**

Create `apps/web/src/hooks/useSSE.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';

type SSEHandler = (event: { type: string; payload: Record<string, unknown> }) => void;

export function useSSE(onEvent: SSEHandler) {
  const token = useAuthStore((s) => s.accessToken);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!token) return;

    const es = new EventSource(`/sse?token=${token}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEventRef.current(data);
      } catch {
        /* ignore parse errors */
      }
    };

    return () => es.close();
  }, [token]);
}
```

- [ ] **Step 3: Create useNotifications hook**

Create `apps/web/src/hooks/useNotifications.ts`:

```typescript
import { useSSE } from './useSSE';
import { trpc } from '@/trpc';
import { useToastStore } from '@/stores/toast.store';

export function useNotifications() {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);

  useSSE((event) => {
    switch (event.type) {
      case 'new-message':
        utils.message.inbox.invalidate();
        utils.message.unreadCount.invalidate();
        addToast(`Nouveau message : ${event.payload.subject}`);
        break;
      case 'building-done':
        utils.building.list.invalidate();
        utils.resource.production.invalidate();
        addToast(`Construction terminée : ${event.payload.buildingId} niv. ${event.payload.level}`);
        break;
      case 'research-done':
        utils.research.list.invalidate();
        addToast(`Recherche terminée : ${event.payload.techId} niv. ${event.payload.level}`);
        break;
      case 'shipyard-done':
        utils.shipyard.queue.invalidate();
        utils.shipyard.ships.invalidate();
        utils.shipyard.defenses.invalidate();
        addToast(`Chantier terminé : ${event.payload.unitId} (x${event.payload.count})`);
        break;
    }
  });
}
```

- [ ] **Step 4: Wire useNotifications and Toaster in Layout**

In `apps/web/src/components/layout/Layout.tsx`:

Add imports:

```typescript
import { useNotifications } from '@/hooks/useNotifications';
import { Toaster } from '@/components/ui/Toaster';
```

Inside the `Layout` component, after the existing `useEffect`, add:

```typescript
  useNotifications();
```

Add `<Toaster />` at the end of the root div, after `</div>` that wraps `<main>`:

The return should become:

```tsx
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar planetId={resolvedPlanetId} planets={planets ?? []} />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ planetId: resolvedPlanetId }} />
        </main>
      </div>
      <Toaster />
    </div>
  );
```

- [ ] **Step 5: Run typecheck**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo typecheck --filter=@ogame-clone/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/vite.config.ts apps/web/src/hooks/ apps/web/src/components/layout/Layout.tsx
git commit -m "feat(web): add SSE hook, notifications hook, wire in Layout"
```

---

### Task 6: TopBar notification bell with unread badge

**Files:**
- Modify: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Add unread count query and notification bell**

In `apps/web/src/components/layout/TopBar.tsx`:

Add import:

```typescript
import { useNavigate } from 'react-router';
```

Inside the `TopBar` component, add after the existing `useAuthStore` hooks:

```typescript
  const navigate = useNavigate();
  const { data: unreadCount } = trpc.message.unreadCount.useQuery();
```

In the JSX, in the `<div className="flex items-center gap-4">` section (before the Déconnexion button), add:

```tsx
        <button
          onClick={() => navigate('/messages')}
          className="relative rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Messages"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </button>
```

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo typecheck --filter=@ogame-clone/web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/TopBar.tsx
git commit -m "feat(web): add notification bell with unread badge in TopBar"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run full typecheck**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo typecheck`
Expected: All packages pass

- [ ] **Step 2: Run lint**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo lint`
Expected: 0 errors (warnings OK)

- [ ] **Step 3: Run tests**

Run: `cd /Users/julienaubree/_projet/ogame-clone && npx turbo test`
Expected: All tests pass
