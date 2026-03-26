# Target Contacts Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Contacts" dropdown next to the fleet send coordinate input, letting players quickly select destinations from their own planets, friends' planets, or alliance members' planets.

**Architecture:** New `ContactService` backend service aggregates planet data from existing friend/alliance services, exposed via a `fleet.contacts` tRPC endpoint. A new `TargetContactsDropdown` React component provides a searchable dropdown with grouped sections, integrated into the fleet send form.

**Tech Stack:** TypeScript, tRPC, Drizzle ORM (PostgreSQL), React 19, Tailwind CSS

---

## File Structure

| File | Role |
|------|------|
| `apps/api/src/modules/fleet/contact.service.ts` | **Create** — Aggregates own/friend/alliance planets |
| `apps/api/src/modules/fleet/fleet.router.ts` | **Modify** — Add `contacts` query, accept `contactService` param |
| `apps/api/src/trpc/app-router.ts` | **Modify** — Wire `contactService` into fleet router |
| `apps/web/src/components/fleet/TargetContactsDropdown.tsx` | **Create** — Searchable contacts dropdown component |
| `apps/web/src/pages/Fleet.tsx` | **Modify** — Integrate dropdown next to CoordinateInput |

---

### Task 1: Create `ContactService`

**Files:**
- Create: `apps/api/src/modules/fleet/contact.service.ts`

This service aggregates contact data from three sources: own planets, friends' planets, and alliance members' planets.

- [ ] **Step 1: Create the contact service file**

```ts
// apps/api/src/modules/fleet/contact.service.ts
import { eq, and, inArray, asc } from 'drizzle-orm';
import { planets } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import type { createFriendService } from '../friend/friend.service.js';
import type { createAllianceService } from '../alliance/alliance.service.js';

interface ContactPlanet {
  name: string;
  galaxy: number;
  system: number;
  position: number;
}

interface MyPlanet extends ContactPlanet {
  id: string;
}

export function createContactService(
  db: Database,
  friendService: ReturnType<typeof createFriendService>,
  allianceService: ReturnType<typeof createAllianceService>,
) {
  async function getPlanetsByUserIds(userIds: string[]): Promise<Map<string, ContactPlanet[]>> {
    if (userIds.length === 0) return new Map();
    const rows = await db
      .select({
        userId: planets.userId,
        name: planets.name,
        galaxy: planets.galaxy,
        system: planets.system,
        position: planets.position,
      })
      .from(planets)
      .where(and(
        inArray(planets.userId, userIds),
        eq(planets.planetType, 'planet'),
      ))
      .orderBy(asc(planets.createdAt));

    const map = new Map<string, ContactPlanet[]>();
    for (const row of rows) {
      const list = map.get(row.userId) ?? [];
      list.push({ name: row.name, galaxy: row.galaxy, system: row.system, position: row.position });
      map.set(row.userId, list);
    }
    return map;
  }

  return {
    async getContacts(userId: string) {
      // 1. Own planets
      const myPlanetRows = await db
        .select({
          id: planets.id,
          name: planets.name,
          galaxy: planets.galaxy,
          system: planets.system,
          position: planets.position,
        })
        .from(planets)
        .where(and(eq(planets.userId, userId), eq(planets.planetType, 'planet')))
        .orderBy(asc(planets.createdAt));

      // 2. Friends
      const friendList = await friendService.list(userId);
      const friendUserIds = friendList.map((f) => f.userId);
      const friendPlanetsMap = await getPlanetsByUserIds(friendUserIds);

      const friends = friendList
        .map((f) => ({
          userId: f.userId,
          username: f.username,
          planets: friendPlanetsMap.get(f.userId) ?? [],
        }))
        .filter((f) => f.planets.length > 0)
        .sort((a, b) => a.username.localeCompare(b.username));

      // 3. Alliance members (deduplicate: exclude self and friends)
      const friendUserIdSet = new Set(friendUserIds);
      const allianceData = await allianceService.myAlliance(userId);
      let allianceTag: string | null = null;
      let allianceMembers: { userId: string; username: string; role: string; planets: ContactPlanet[] }[] = [];

      if (allianceData) {
        allianceTag = allianceData.tag;
        const otherMembers = allianceData.members.filter(
          (m) => m.userId !== userId && !friendUserIdSet.has(m.userId),
        );
        const allianceUserIds = otherMembers.map((m) => m.userId);
        const alliancePlanetsMap = await getPlanetsByUserIds(allianceUserIds);

        allianceMembers = otherMembers
          .map((m) => ({
            userId: m.userId,
            username: m.username,
            role: m.role,
            planets: alliancePlanetsMap.get(m.userId) ?? [],
          }))
          .filter((m) => m.planets.length > 0)
          .sort((a, b) => a.username.localeCompare(b.username));
      }

      return {
        myPlanets: myPlanetRows,
        friends,
        allianceMembers,
        allianceTag,
      };
    },
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/api/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/fleet/contact.service.ts
git commit -m "feat: add ContactService for aggregating fleet target contacts"
```

---

### Task 2: Wire endpoint into fleet router and app router

**Files:**
- Modify: `apps/api/src/modules/fleet/fleet.router.ts`
- Modify: `apps/api/src/trpc/app-router.ts`

- [ ] **Step 1: Modify fleet router to accept `contactService` and add `contacts` query**

In `apps/api/src/modules/fleet/fleet.router.ts`:

1. Add import for `createContactService`:
```ts
import type { createContactService } from './contact.service.js';
```

2. Change the function signature to accept a second parameter:
```ts
export function createFleetRouter(
  fleetService: ReturnType<typeof createFleetService>,
  contactService: ReturnType<typeof createContactService>,
) {
```

3. Add the `contacts` query inside the `router({})` object, after the `inbound` endpoint:
```ts
    contacts: protectedProcedure
      .query(async ({ ctx }) => {
        return contactService.getContacts(ctx.userId!);
      }),
```

- [ ] **Step 2: Wire `contactService` in `app-router.ts`**

In `apps/api/src/trpc/app-router.ts`:

1. Add import (after line 18 which imports `createFleetRouter`):
```ts
import { createContactService } from '../modules/fleet/contact.service.js';
```

2. After line 69 (where `fleetService` is created), add:
```ts
  const contactService = createContactService(db, friendService, allianceService);
```

3. Change line 82 from:
```ts
  const fleetRouter = createFleetRouter(fleetService);
```
to:
```ts
  const fleetRouter = createFleetRouter(fleetService, contactService);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/api/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/fleet/fleet.router.ts apps/api/src/trpc/app-router.ts
git commit -m "feat: wire fleet.contacts endpoint into router"
```

---

### Task 3: Create `TargetContactsDropdown` component

**Files:**
- Create: `apps/web/src/components/fleet/TargetContactsDropdown.tsx`

This component renders the icon button + searchable dropdown with three grouped sections.

**Key patterns from existing codebase:**
- `trpc` imported from `@/trpc`
- Tailwind classes used for all styling (no CSS modules)
- `cn()` utility from `@/lib/utils` for conditional classes
- Existing fleet components in `apps/web/src/components/fleet/`

- [ ] **Step 1: Create the component file**

```tsx
// apps/web/src/components/fleet/TargetContactsDropdown.tsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';

interface Props {
  onSelect: (coords: { galaxy: number; system: number; position: number }) => void;
  disabled?: boolean;
}

const fmtCoords = (g: number, s: number, p: number) => `[${g}:${s}:${p}]`;

export function TargetContactsDropdown({ onSelect, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data } = trpc.fleet.contacts.useQuery(undefined, {
    enabled: isOpen,
    staleTime: 60_000,
  });

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Auto-focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const q = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!data) return null;

    const myPlanets = data.myPlanets.filter(
      (p) => !q || p.name.toLowerCase().includes(q),
    );

    const friends = data.friends
      .map((f) => ({
        ...f,
        planets: f.planets.filter(
          (p) => !q || f.username.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
        ),
      }))
      .filter((f) => f.planets.length > 0);

    const allianceMembers = data.allianceMembers
      .map((m) => ({
        ...m,
        planets: m.planets.filter(
          (p) => !q || m.username.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
        ),
      }))
      .filter((m) => m.planets.length > 0);

    const total = myPlanets.length + friends.reduce((s, f) => s + f.planets.length, 0) + allianceMembers.reduce((s, m) => s + m.planets.length, 0);

    return { myPlanets, friends, allianceMembers, allianceTag: data.allianceTag, total };
  }, [data, q]);

  function handleSelect(galaxy: number, system: number, position: number) {
    onSelect({ galaxy, system, position });
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        disabled={disabled}
        title="Contacts"
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-card/60 px-2.5 py-2 text-muted-foreground transition-colors',
          'hover:bg-primary/10 hover:text-primary hover:border-primary/40',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {/* Address book icon (SVG) */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          <circle cx="12" cy="10" r="2" />
          <path d="M15 15a3 3 0 0 0-6 0" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border bg-card shadow-xl">
          {/* Search bar */}
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {!filtered ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Chargement...</div>
            ) : filtered.total === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Aucun résultat</div>
            ) : (
              <>
                {/* My planets */}
                {filtered.myPlanets.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      Mes planètes
                    </div>
                    {filtered.myPlanets.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelect(p.galaxy, p.system, p.position)}
                        className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-primary/10 transition-colors"
                      >
                        <span className="text-foreground truncate">{p.name}</span>
                        <span className="text-muted-foreground font-mono text-[11px]">{fmtCoords(p.galaxy, p.system, p.position)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Friends */}
                {filtered.friends.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                      Amis
                    </div>
                    {filtered.friends.map((f) => (
                      <div key={f.userId}>
                        <div className="px-3 py-1 text-[11px] font-medium text-blue-300">{f.username}</div>
                        {f.planets.map((p, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelect(p.galaxy, p.system, p.position)}
                            className="flex w-full items-center justify-between px-3 py-2 pl-6 text-xs hover:bg-primary/10 transition-colors"
                          >
                            <span className="text-foreground/80 truncate">{p.name}</span>
                            <span className="text-muted-foreground font-mono text-[11px]">{fmtCoords(p.galaxy, p.system, p.position)}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Alliance members */}
                {filtered.allianceMembers.length > 0 && (
                  <div>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                      Alliance{filtered.allianceTag ? ` [${filtered.allianceTag}]` : ''}
                    </div>
                    {filtered.allianceMembers.map((m) => (
                      <div key={m.userId}>
                        <div className="px-3 py-1 text-[11px] font-medium text-amber-300">
                          {m.username}
                          <span className="ml-1.5 text-[9px] text-amber-500/70 uppercase">{m.role}</span>
                        </div>
                        {m.planets.map((p, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleSelect(p.galaxy, p.system, p.position)}
                            className="flex w-full items-center justify-between px-3 py-2 pl-6 text-xs hover:bg-primary/10 transition-colors"
                          >
                            <span className="text-foreground/80 truncate">{p.name}</span>
                            <span className="text-muted-foreground font-mono text-[11px]">{fmtCoords(p.galaxy, p.system, p.position)}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty states for sections without search */}
                {!q && data && data.friends.length === 0 && (
                  <div>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                      Amis
                    </div>
                    <div className="px-3 py-3 text-xs text-muted-foreground/60 italic">Aucun ami ajouté</div>
                  </div>
                )}
                {!q && data && !data.allianceTag && (
                  <div>
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                      Alliance
                    </div>
                    <div className="px-3 py-3 text-xs text-muted-foreground/60 italic">Pas d'alliance</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/fleet/TargetContactsDropdown.tsx
git commit -m "feat: add TargetContactsDropdown component with search and grouped sections"
```

---

### Task 4: Integrate dropdown into Fleet send form

**Files:**
- Modify: `apps/web/src/pages/Fleet.tsx:1,296-305`

- [ ] **Step 1: Add import**

At the top of `apps/web/src/pages/Fleet.tsx`, after the existing fleet component imports (around line 15), add:
```ts
import { TargetContactsDropdown } from '@/components/fleet/TargetContactsDropdown';
```

- [ ] **Step 2: Add dropdown next to CoordinateInput**

Replace the destination section (lines 295-305):

From:
```tsx
      {/* Destination */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">Cible</span>
        <CoordinateInput
          galaxy={target.galaxy}
          system={target.system}
          position={target.position}
          onChange={setTarget}
          disabled={pveMode || tradeMode}
        />
      </div>
```

To:
```tsx
      {/* Destination */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">Cible</span>
        <CoordinateInput
          galaxy={target.galaxy}
          system={target.system}
          position={target.position}
          onChange={setTarget}
          disabled={pveMode || tradeMode}
        />
        {!(pveMode || tradeMode) && (
          <TargetContactsDropdown onSelect={setTarget} />
        )}
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit and push**

```bash
git add apps/web/src/pages/Fleet.tsx
git commit -m "feat: integrate contacts dropdown into fleet send form"
git push
```
