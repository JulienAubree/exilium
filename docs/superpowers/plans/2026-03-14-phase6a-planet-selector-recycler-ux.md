# Phase 6a: Planet Selector + Recycler UX — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a planet selector dropdown in the topbar to switch between colonies, and make the debris field badge in galaxy view clickable to pre-fill the fleet wizard for recycling missions.

**Architecture:** A new zustand store (`planetStore`) persists the active planet ID in localStorage. `Layout.tsx` reads from this store instead of hardcoding the first planet, propagating the selected planet to all child pages via `useOutletContext`. The Galaxy page's DF badge becomes a `<Link>` to `/fleet?mission=recycle&...`, and Fleet.tsx reads query params on mount to pre-fill the wizard.

**Tech Stack:** React, Zustand, React Router (useSearchParams, Link), tRPC, Drizzle ORM

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/stores/planet.store.ts` | Create | Zustand store: `activePlanetId`, `setActivePlanet`, `clearActivePlanet` |
| `apps/api/src/modules/planet/planet.service.ts` | Modify | Add `.orderBy(asc(planets.createdAt))` to `listPlanets` |
| `apps/web/src/components/layout/Layout.tsx` | Modify | Read `activePlanetId` from store, pass to children |
| `apps/web/src/components/layout/TopBar.tsx` | Modify | Planet dropdown selector + logout button |
| `apps/web/src/pages/Galaxy.tsx` | Modify | DF badge → clickable `<Link>` to Fleet |
| `apps/web/src/pages/Fleet.tsx` | Modify | Read query params, pre-fill wizard |

---

## Chunk 1: Backend + Store + Layout

### Task 1: Add orderBy to `listPlanets`

**Files:**
- Modify: `apps/api/src/modules/planet/planet.service.ts:49-53`

- [ ] **Step 1: Add `asc` import and orderBy clause**

In `apps/api/src/modules/planet/planet.service.ts`, add `asc` to the drizzle-orm import:

```typescript
import { eq, asc } from 'drizzle-orm';
```

Then modify the `listPlanets` method to sort by `createdAt`:

```typescript
async listPlanets(userId: string) {
  return db
    .select()
    .from(planets)
    .where(eq(planets.userId, userId))
    .orderBy(asc(planets.createdAt));
},
```

- [ ] **Step 2: Verify typecheck passes**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo typecheck --filter=@ogame-clone/api`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/planet/planet.service.ts
git commit -m "feat(api): sort listPlanets by createdAt ascending"
```

---

### Task 2: Create `planetStore`

**Files:**
- Create: `apps/web/src/stores/planet.store.ts`

- [ ] **Step 1: Create the store**

Create `apps/web/src/stores/planet.store.ts`:

```typescript
import { create } from 'zustand';

interface PlanetState {
  activePlanetId: string | null;
  setActivePlanet: (id: string) => void;
  clearActivePlanet: () => void;
}

export const usePlanetStore = create<PlanetState>((set) => ({
  activePlanetId: localStorage.getItem('activePlanetId'),

  setActivePlanet: (id: string) => {
    localStorage.setItem('activePlanetId', id);
    set({ activePlanetId: id });
  },

  clearActivePlanet: () => {
    localStorage.removeItem('activePlanetId');
    set({ activePlanetId: null });
  },
}));
```

This follows the same manual localStorage pattern used by `apps/web/src/stores/auth.store.ts`.

- [ ] **Step 2: Verify typecheck passes**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo typecheck --filter=@ogame-clone/web`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/stores/planet.store.ts
git commit -m "feat(web): create planetStore with localStorage persistence"
```

---

### Task 3: Wire `Layout.tsx` to use `planetStore`

**Files:**
- Modify: `apps/web/src/components/layout/Layout.tsx`

- [ ] **Step 1: Update Layout to read from planetStore**

Replace the entire content of `apps/web/src/components/layout/Layout.tsx`:

```typescript
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';

export function Layout() {
  const { data: planets } = trpc.planet.list.useQuery();
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);

  // Resolve the active planet: use store value if valid, else fallback to first planet
  const resolvedPlanetId = planets?.find((p) => p.id === activePlanetId)
    ? activePlanetId
    : planets?.[0]?.id ?? null;

  // Sync store if fallback was used
  useEffect(() => {
    if (resolvedPlanetId && resolvedPlanetId !== activePlanetId) {
      setActivePlanet(resolvedPlanetId);
    }
  }, [resolvedPlanetId, activePlanetId, setActivePlanet]);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar planetId={resolvedPlanetId} planets={planets ?? []} />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ planetId: resolvedPlanetId }} />
        </main>
      </div>
    </div>
  );
}
```

Key changes:
- Imports `useEffect`, `usePlanetStore`
- Resolves `activePlanetId` from store, validates it exists in the player's planets list
- Falls back to first planet and syncs store if needed
- Passes `planets` array to TopBar for the dropdown

- [ ] **Step 2: Do NOT commit yet — TopBar needs Task 4 changes first for typecheck to pass**

---

### Task 4: Add planet dropdown + logout to TopBar (commit with Task 3)

**Files:**
- Modify: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Update TopBar with dropdown and logout**

Replace the entire content of `apps/web/src/components/layout/TopBar.tsx`:

```typescript
import { useState } from 'react';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { usePlanetStore } from '@/stores/planet.store';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
}

interface ResourceDisplayProps {
  label: string;
  value: number;
  color: string;
}

function ResourceDisplay({ label, value, color }: ResourceDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {value.toLocaleString('fr-FR')}
      </span>
    </div>
  );
}

export function TopBar({ planetId, planets }: { planetId: string | null; planets: Planet[] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const clearActivePlanet = usePlanetStore((s) => s.clearActivePlanet);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId, refetchInterval: 60_000 },
  );

  const resources = useResourceCounter(
    data
      ? {
          metal: data.metal,
          crystal: data.crystal,
          deuterium: data.deuterium,
          resourcesUpdatedAt: data.resourcesUpdatedAt,
          metalPerHour: data.rates.metalPerHour,
          crystalPerHour: data.rates.crystalPerHour,
          deutPerHour: data.rates.deutPerHour,
          storageMetalCapacity: data.rates.storageMetalCapacity,
          storageCrystalCapacity: data.rates.storageCrystalCapacity,
          storageDeutCapacity: data.rates.storageDeutCapacity,
        }
      : undefined,
  );

  const energyBalance = data ? data.rates.energyProduced - data.rates.energyConsumed : 0;
  const activePlanet = planets.find((p) => p.id === planetId);

  const handleSelectPlanet = (id: string) => {
    setActivePlanet(id);
    setDropdownOpen(false);
  };

  const handleLogout = () => {
    clearActivePlanet();
    clearAuth();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-6">
        {/* Planet selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-accent"
          >
            <span className="font-medium">
              {activePlanet ? `${activePlanet.name} [${activePlanet.galaxy}:${activePlanet.system}:${activePlanet.position}]` : 'Planète'}
            </span>
            <span className="text-xs">&#9660;</span>
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-md border border-border bg-card shadow-lg">
              {planets.map((planet) => (
                <button
                  key={planet.id}
                  onClick={() => handleSelectPlanet(planet.id)}
                  className={`flex w-full items-center px-3 py-2 text-sm hover:bg-accent ${
                    planet.id === planetId ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  {planet.name} [{planet.galaxy}:{planet.system}:{planet.position}]
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resources */}
        <ResourceDisplay label="Métal" value={resources.metal} color="text-metal" />
        <ResourceDisplay label="Cristal" value={resources.crystal} color="text-crystal" />
        <ResourceDisplay label="Deutérium" value={resources.deuterium} color="text-deuterium" />
        <ResourceDisplay
          label="Énergie"
          value={energyBalance}
          color={energyBalance >= 0 ? 'text-energy' : 'text-destructive'}
        />
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
```

Key changes:
- Planet dropdown left of resource counters with `nom [g:s:p]` format
- Active planet highlighted in dropdown
- Clicking a planet calls `setActivePlanet(id)` → Layout resolves new planetId → resources refresh
- Logout button calls both `clearActivePlanet()` and `clearAuth()`
- Click outside dropdown doesn't auto-close (simple implementation — click the button again to toggle)

- [ ] **Step 2: Verify typecheck passes**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo typecheck --filter=@ogame-clone/web`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/Layout.tsx apps/web/src/components/layout/TopBar.tsx
git commit -m "feat(web): add planet selector dropdown, logout, and wire Layout to planetStore"
```

---

## Chunk 2: Recycler UX (Galaxy + Fleet)

### Task 5: Make DF badge clickable in Galaxy.tsx

**Files:**
- Modify: `apps/web/src/pages/Galaxy.tsx:101-113`

- [ ] **Step 1: Add Link import and make DF badge a link**

In `apps/web/src/pages/Galaxy.tsx`, add `Link` to the react-router import:

```typescript
import { useState } from 'react';
import { Link } from 'react-router';
```

Then replace the DF badge `<span>` (lines 109-112) with a `<Link>`:

Find this code:
```tsx
{(slot as any).debris && ((slot as any).debris.metal > 0 || (slot as any).debris.crystal > 0) && (
  <span className="text-xs text-orange-400 ml-2" title={`Débris: ${(slot as any).debris.metal.toLocaleString('fr-FR')} métal, ${(slot as any).debris.crystal.toLocaleString('fr-FR')} cristal`}>
    DF
  </span>
)}
```

Replace with:
```tsx
{(slot as any).debris && ((slot as any).debris.metal > 0 || (slot as any).debris.crystal > 0) && (
  <Link
    to={`/fleet?mission=recycle&galaxy=${galaxy}&system=${system}&position=${i + 1}`}
    className="text-xs text-orange-400 ml-2 hover:underline cursor-pointer"
    title={`Débris: ${(slot as any).debris.metal.toLocaleString('fr-FR')} métal, ${(slot as any).debris.crystal.toLocaleString('fr-FR')} cristal`}
  >
    DF
  </Link>
)}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo typecheck --filter=@ogame-clone/web`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Galaxy.tsx
git commit -m "feat(web): make DF badge a clickable link to fleet recycling"
```

---

### Task 6: Fleet wizard pre-fill from query params

**Files:**
- Modify: `apps/web/src/pages/Fleet.tsx:1-53`

- [ ] **Step 1: Add query param reading and pre-fill logic**

In `apps/web/src/pages/Fleet.tsx`, add `useSearchParams` to the react-router import and `useEffect` to the react import:

```typescript
import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams } from 'react-router';
```

Then, inside the `Fleet` component, right after the existing state declarations (after line 53 — the `cargo` useState), add:

```typescript
const [searchParams, setSearchParams] = useSearchParams();
const [prefillWarning, setPrefillWarning] = useState<string | null>(null);
```

Then, after the `ships` query (after the `useQuery` block around line 58), add a ref and two `useEffect` hooks. The ref stores query param data so the second effect can use it after the first clears the URL:

```typescript
const prefillRef = useRef<{ mission: Mission; galaxy: number; system: number; position: number } | null>(null);

// Read query params once on mount
useEffect(() => {
  const paramMission = searchParams.get('mission') as Mission | null;
  if (!paramMission) return;

  const data = {
    mission: paramMission,
    galaxy: Number(searchParams.get('galaxy')) || 1,
    system: Number(searchParams.get('system')) || 1,
    position: Number(searchParams.get('position')) || 1,
  };

  prefillRef.current = data;
  setTarget({ galaxy: data.galaxy, system: data.system, position: data.position });
  setMission(data.mission);

  // Clear params from URL
  setSearchParams({}, { replace: true });
}, []); // eslint-disable-line react-hooks/exhaustive-deps

// Auto-select ships and jump to step 2 when ships data loads
useEffect(() => {
  if (!prefillRef.current || !ships) return;

  if (prefillRef.current.mission === 'recycle') {
    const recyclerData = ships.find((s) => s.id === 'recycler');
    if (!recyclerData || recyclerData.count === 0) {
      setPrefillWarning('Aucun recycleur disponible sur cette planète.');
      prefillRef.current = null;
      return;
    }
    setSelectedShips({ recycler: recyclerData.count });
  }

  setStep(2);
  prefillRef.current = null;
}, [ships]);
```

- [ ] **Step 2: Display the warning message in step 1**

In the step 1 section of the JSX, right before the "Aucun vaisseau disponible" check (around line 121), add:

```tsx
{prefillWarning && (
  <p className="text-sm text-orange-400">{prefillWarning}</p>
)}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo typecheck --filter=@ogame-clone/web`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Fleet.tsx
git commit -m "feat(web): pre-fill fleet wizard from URL query params for recycling"
```

---

## Chunk 3: Verification

### Task 7: Full typecheck + lint + manual verification

- [ ] **Step 1: Run full typecheck**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo typecheck`
Expected: All packages pass

- [ ] **Step 2: Run lint**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo lint`
Expected: No errors

- [ ] **Step 3: Run tests**

Run: `export PATH="/usr/local/opt/node@22/bin:$PATH" && cd /Users/julienaubree/_projet/ogame-clone && pnpm turbo test`
Expected: All tests pass

- [ ] **Step 4: Fix any issues found**

If typecheck/lint/test failures occur, fix them and commit fixes.

- [ ] **Step 5: Final commit if needed**

If any fixes were made, commit them:
```bash
git commit -m "fix: resolve typecheck/lint issues for phase 6a"
```
