# Notification Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players control which event categories trigger toasts, push notifications, and game events (bell) via a preferences grid in their Profile.

**Architecture:** 6 tasks: DB schema, shared constants, API service+router, backend filtering (push+bell), frontend preferences UI, frontend toast filtering + bell gear icon.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, Zod, React, Zustand, Tailwind CSS

---

### Task 1: Create DB schema for notification_preferences

**Files:**
- Create: `packages/db/src/schema/notification-preferences.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create the schema file**

Create `packages/db/src/schema/notification-preferences.ts`:

```ts
import { pgTable, uuid, timestamp, text, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  toastDisabled: text('toast_disabled').array().notNull().default([]),
  pushDisabled: text('push_disabled').array().notNull().default([]),
  bellDisabled: text('bell_disabled').array().notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Export from schema index**

In `packages/db/src/schema/index.ts`, add at the end:

```ts
export * from './notification-preferences.js';
```

- [ ] **Step 3: Build the package**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium/packages/db && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/notification-preferences.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add notification_preferences table schema"
```

---

### Task 2: Create shared notification category constants

**Files:**
- Create: `packages/shared/src/types/notifications.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the constants file**

Create `packages/shared/src/types/notifications.ts`:

```ts
export const NOTIFICATION_CATEGORIES = [
  'building',
  'research',
  'shipyard',
  'fleet',
  'combat',
  'message',
  'market',
  'alliance',
  'social',
  'quest',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  building: 'Bâtiments',
  research: 'Recherche',
  shipyard: 'Chantier spatial & Centre de commandement',
  fleet: 'Flottes',
  combat: 'Combat',
  message: 'Messages',
  market: 'Marché galactique',
  alliance: 'Alliance',
  social: 'Social',
  quest: 'Missions & Quêtes',
};

/** Map SSE event type to notification category */
export const EVENT_TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  'building-done': 'building',
  'research-done': 'research',
  'shipyard-done': 'shipyard',
  'fleet-arrived': 'fleet',
  'fleet-returned': 'fleet',
  'fleet-inbound': 'fleet',
  'fleet-attack-landed': 'combat',
  'fleet-hostile-inbound': 'combat',
  'flagship-incapacitated': 'combat',
  'new-message': 'message',
  'new-reply': 'message',
  'market-offer-reserved': 'market',
  'market-offer-sold': 'market',
  'market-offer-expired': 'market',
  'market-reservation-expired': 'market',
  'new-alliance-message': 'alliance',
  'alliance-activity': 'alliance',
  'friend-request': 'social',
  'friend-accepted': 'social',
  'friend-declined': 'social',
  'daily-quest-completed': 'quest',
  'tutorial-quest-complete': 'quest',
};
```

- [ ] **Step 2: Export from shared index**

In `packages/shared/src/index.ts`, add:

```ts
export * from './types/notifications.js';
```

- [ ] **Step 3: Build**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/notifications.ts packages/shared/src/index.ts
git commit -m "feat(shared): add notification category constants and event type mapping"
```

---

### Task 3: Create notification preferences API (service + router)

**Files:**
- Create: `apps/api/src/modules/notification/notification-preferences.service.ts`
- Create: `apps/api/src/modules/notification/notification-preferences.router.ts`
- Modify: `apps/api/src/trpc/app-router.ts`

- [ ] **Step 1: Create the service**

Create `apps/api/src/modules/notification/notification-preferences.service.ts`:

```ts
import { eq } from 'drizzle-orm';
import { notificationPreferences } from '@exilium/db';
import type { Database } from '@exilium/db';

export interface NotificationPrefs {
  toastDisabled: string[];
  pushDisabled: string[];
  bellDisabled: string[];
}

const DEFAULTS: NotificationPrefs = { toastDisabled: [], pushDisabled: [], bellDisabled: [] };

export function createNotificationPreferencesService(db: Database) {
  return {
    async getPreferences(userId: string): Promise<NotificationPrefs> {
      const [row] = await db
        .select({
          toastDisabled: notificationPreferences.toastDisabled,
          pushDisabled: notificationPreferences.pushDisabled,
          bellDisabled: notificationPreferences.bellDisabled,
        })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);
      return row ?? DEFAULTS;
    },

    async updatePreferences(userId: string, prefs: NotificationPrefs): Promise<NotificationPrefs> {
      const [row] = await db
        .insert(notificationPreferences)
        .values({
          userId,
          toastDisabled: prefs.toastDisabled,
          pushDisabled: prefs.pushDisabled,
          bellDisabled: prefs.bellDisabled,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: notificationPreferences.userId,
          set: {
            toastDisabled: prefs.toastDisabled,
            pushDisabled: prefs.pushDisabled,
            bellDisabled: prefs.bellDisabled,
            updatedAt: new Date(),
          },
        })
        .returning({
          toastDisabled: notificationPreferences.toastDisabled,
          pushDisabled: notificationPreferences.pushDisabled,
          bellDisabled: notificationPreferences.bellDisabled,
        });
      return row;
    },
  };
}
```

- [ ] **Step 2: Create the router**

Create `apps/api/src/modules/notification/notification-preferences.router.ts`:

```ts
import { z } from 'zod';
import { protectedProcedure, router } from '../../trpc/router.js';
import { NOTIFICATION_CATEGORIES } from '@exilium/shared';
import type { createNotificationPreferencesService } from './notification-preferences.service.js';

const categoryEnum = z.enum(NOTIFICATION_CATEGORIES as unknown as [string, ...string[]]);

export function createNotificationPreferencesRouter(
  service: ReturnType<typeof createNotificationPreferencesService>,
) {
  return router({
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      return service.getPreferences(ctx.userId!);
    }),

    updatePreferences: protectedProcedure
      .input(z.object({
        toastDisabled: z.array(categoryEnum),
        pushDisabled: z.array(categoryEnum),
        bellDisabled: z.array(categoryEnum),
      }))
      .mutation(async ({ ctx, input }) => {
        return service.updatePreferences(ctx.userId!, input);
      }),
  });
}
```

- [ ] **Step 3: Wire into app-router.ts**

In `apps/api/src/trpc/app-router.ts`:

Add imports at top:
```ts
import { createNotificationPreferencesService } from '../modules/notification/notification-preferences.service.js';
import { createNotificationPreferencesRouter } from '../modules/notification/notification-preferences.router.js';
```

After existing service creations (around line 92), add:
```ts
const notificationPreferencesService = createNotificationPreferencesService(db);
```

In the router object (around line 122), add:
```ts
  notificationPreferences: createNotificationPreferencesRouter(notificationPreferencesService),
```

- [ ] **Step 4: Build**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && pnpm build`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notification/notification-preferences.service.ts apps/api/src/modules/notification/notification-preferences.router.ts apps/api/src/trpc/app-router.ts
git commit -m "feat(api): add notification preferences service and router"
```

---

### Task 4: Backend filtering — push and bell

**Files:**
- Modify: `apps/api/src/modules/push/push.service.ts`
- Modify: `apps/api/src/modules/game-event/game-event.service.ts`

- [ ] **Step 1: Update push service to use notification_preferences**

In `apps/api/src/modules/push/push.service.ts`:

Add imports at top:
```ts
import { notificationPreferences } from '@exilium/db';
import { EVENT_TYPE_TO_CATEGORY } from '@exilium/shared';
```

In the `sendToUser` method (around line 71), the current signature is:
```ts
async sendToUser(userId: string, category: PushCategory, payload: { title: string; body: string; url?: string })
```

Add a check at the start of the method, after the VAPID guard:
```ts
    // Check user notification preferences
    const [prefs] = await db
      .select({ pushDisabled: notificationPreferences.pushDisabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    if (prefs?.pushDisabled?.includes(category)) return;
```

This replaces the per-subscription `prefs[category] === false` check. Keep the per-subscription check as fallback for now (it won't hurt).

- [ ] **Step 2: Update game event service to check bell preferences**

In `apps/api/src/modules/game-event/game-event.service.ts`:

Add imports:
```ts
import { notificationPreferences } from '@exilium/db';
import { EVENT_TYPE_TO_CATEGORY } from '@exilium/shared';
```

In the `insert` method (around line 10), wrap the existing insert with a preferences check:

Replace:
```ts
async insert(userId: string, planetId: string | null, type: GameEventType, payload: Record<string, unknown>) {
  await db.insert(gameEvents).values({ userId, planetId, type, payload });
},
```

With:
```ts
async insert(userId: string, planetId: string | null, type: GameEventType, payload: Record<string, unknown>) {
  const category = EVENT_TYPE_TO_CATEGORY[type];
  if (category) {
    const [prefs] = await db
      .select({ bellDisabled: notificationPreferences.bellDisabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    if (prefs?.bellDisabled?.includes(category)) return;
  }
  await db.insert(gameEvents).values({ userId, planetId, type, payload });
},
```

- [ ] **Step 3: Build**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/push/push.service.ts apps/api/src/modules/game-event/game-event.service.ts
git commit -m "feat(api): filter push and bell notifications by user preferences"
```

---

### Task 5: Frontend — Notification preferences tab in Profile

**Files:**
- Create: `apps/web/src/components/profile/NotificationPreferences.tsx`
- Modify: `apps/web/src/pages/Profile.tsx`

- [ ] **Step 1: Create the NotificationPreferences component**

Create `apps/web/src/components/profile/NotificationPreferences.tsx`:

```tsx
import { trpc } from '@/trpc';
import { useCallback, useRef } from 'react';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_LABELS } from '@exilium/shared';
import type { NotificationCategory } from '@exilium/shared';

const CHANNELS = ['toastDisabled', 'pushDisabled', 'bellDisabled'] as const;
const CHANNEL_LABELS = { toastDisabled: 'Toast', pushDisabled: 'Push', bellDisabled: 'Cloche' };
const CHANNEL_ICONS = {
  toastDisabled: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/></svg>
  ),
  pushDisabled: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
  ),
  bellDisabled: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
  ),
};

export function NotificationPreferences() {
  const { data: prefs, isLoading } = trpc.notificationPreferences.getPreferences.useQuery();
  const utils = trpc.useUtils();
  const mutation = trpc.notificationPreferences.updatePreferences.useMutation({
    onSuccess: (data) => {
      utils.notificationPreferences.getPreferences.setData(undefined, data);
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingRef = useRef<typeof prefs>(undefined);

  const scheduleUpdate = useCallback((next: NonNullable<typeof prefs>) => {
    pendingRef.current = next;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (pendingRef.current) {
        mutation.mutate(pendingRef.current);
      }
    }, 500);
  }, [mutation]);

  function toggle(channel: typeof CHANNELS[number], category: NotificationCategory) {
    if (!prefs) return;
    const current = prefs[channel];
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    const updated = { ...prefs, [channel]: next };
    utils.notificationPreferences.getPreferences.setData(undefined, updated);
    scheduleUpdate(updated);
  }

  if (isLoading || !prefs) {
    return <div className="text-sm text-muted-foreground p-4">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Choisissez quels événements déclenchent chaque type de notification.
      </p>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_repeat(3,56px)] gap-1 items-center text-center">
        <div />
        {CHANNELS.map((ch) => (
          <div key={ch} className="flex flex-col items-center gap-0.5">
            {CHANNEL_ICONS[ch]}
            <span className="text-[10px] text-muted-foreground">{CHANNEL_LABELS[ch]}</span>
          </div>
        ))}
      </div>

      {/* Category rows */}
      {NOTIFICATION_CATEGORIES.map((cat) => (
        <div
          key={cat}
          className="grid grid-cols-[1fr_repeat(3,56px)] gap-1 items-center rounded-lg border border-border/50 px-3 py-2"
        >
          <span className="text-sm">{NOTIFICATION_CATEGORY_LABELS[cat]}</span>
          {CHANNELS.map((ch) => {
            const disabled = prefs[ch].includes(cat);
            return (
              <div key={ch} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => toggle(ch, cat)}
                  className={`h-5 w-9 rounded-full transition-colors ${disabled ? 'bg-muted' : 'bg-emerald-500'}`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${disabled ? 'translate-x-0.5' : 'translate-x-[18px]'}`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add Notifications tab to Profile.tsx**

In `apps/web/src/pages/Profile.tsx`:

Add import at top:
```ts
import { NotificationPreferences } from '@/components/profile/NotificationPreferences';
import { useSearchParams } from 'react-router-dom';
```

Inside the component function (after the existing state declarations), add:
```ts
const [searchParams] = useSearchParams();
const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>(
  searchParams.get('tab') === 'notifications' ? 'notifications' : 'profile',
);
```

After `<PageHeader title="Profil" />`, add tab buttons:
```tsx
      <div className="flex gap-1 border-b border-border/50 pb-0">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Profil
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Notifications
        </button>
      </div>
```

Wrap the existing profile content (the `<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]...">` block) in a conditional:
```tsx
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
          {/* ... existing profile content ... */}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="max-w-2xl">
          <div className="glass-card p-4 lg:p-6">
            <h2 className="text-lg font-semibold mb-4">Préférences de notifications</h2>
            <NotificationPreferences />
          </div>
        </div>
      )}
```

Add `useSearchParams` import from `react-router-dom` if not already present.

- [ ] **Step 3: Build**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/profile/NotificationPreferences.tsx apps/web/src/pages/Profile.tsx
git commit -m "feat(web): add notification preferences tab in Profile page"
```

---

### Task 6: Frontend — Toast filtering + bell gear icon

**Files:**
- Modify: `apps/web/src/hooks/useNotifications.ts`
- Modify: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Filter toasts by preferences in useNotifications**

In `apps/web/src/hooks/useNotifications.ts`:

Add import at top:
```ts
import { EVENT_TYPE_TO_CATEGORY } from '@exilium/shared';
```

Inside the `useNotifications` function, before the `useSSE` call, add a query for preferences:
```ts
  const { data: notifPrefs } = trpc.notificationPreferences.getPreferences.useQuery();
```

Create a helper inside the function:
```ts
  function isToastEnabled(eventType: string): boolean {
    if (!notifPrefs) return true; // Default: all enabled
    const category = EVENT_TYPE_TO_CATEGORY[eventType];
    if (!category) return true; // Unknown event types always show
    return !notifPrefs.toastDisabled.includes(category);
  }
```

Then, in each `case` of the switch statement, wrap each `addToast(...)` and `showBrowserNotification(...)` call with:
```ts
if (isToastEnabled(event.type)) {
  addToast(...);
  showBrowserNotification(...);
}
```

IMPORTANT: Keep the tRPC query invalidations (`utils.*.invalidate()`) unconditional — they must always fire regardless of notification preferences. Only the `addToast` and `showBrowserNotification` calls are conditional.

Also keep the chat store logic (for `new-message` and `new-alliance-message`) unconditional — opening chat windows is a functional behavior, not a notification.

- [ ] **Step 2: Add gear icon next to bell in TopBar**

In `apps/web/src/components/layout/TopBar.tsx`, find the bell button div (around line 328). After the bell `<button>` closing tag but still inside the `<div className="relative" ref={bellRef}>`, add a settings gear link:

```tsx
              <Link
                to="/profile?tab=notifications"
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Réglages notifications"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </Link>
```

Add `Link` import from `react-router-dom` if not already present.

- [ ] **Step 3: Build**

Run: `cd /Users/julienaubree/_projet/exilium-game/exilium && pnpm build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useNotifications.ts apps/web/src/components/layout/TopBar.tsx
git commit -m "feat(web): filter toasts by preferences and add gear icon on bell"
```
