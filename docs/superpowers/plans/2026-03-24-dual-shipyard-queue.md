# Dual Shipyard Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate ship production into two independent queues tied to their production building (shipyard for industrial, commandCenter for military), add a new "Centre de commandement" page, and update navigation.

**Architecture:** Add a nullable `facilityId` column to `buildQueue` that identifies the production building. The shipyard service filters queue operations by `(type, facilityId)` instead of `type` alone, enabling parallel production. A new `CommandCenter.tsx` page reuses the same tRPC endpoints with a `facilityId` filter.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, React, TailwindCSS

---

## File Map

**Modify:**
- `packages/db/src/schema/build-queue.ts` — add `facilityId` column
- `apps/api/src/modules/shipyard/shipyard.service.ts` — add `getFacilityId` helper, update queue filtering in `getShipyardQueue`, `startBuild`, `activateNextBatch`, `completeUnit`, `cancelBatch`
- `apps/api/src/modules/shipyard/shipyard.router.ts` — add optional `facilityId` to queue input, pass to service
- `apps/web/src/pages/Shipyard.tsx` — filter categories to `ship_transport` + `ship_utilitaire`, pass `facilityId: 'shipyard'` to queue query
- `apps/web/src/lib/icons.tsx` — add `CommandCenterIcon`
- `apps/web/src/components/layout/Sidebar.tsx` — add "Centre de commandement" entry
- `apps/web/src/components/layout/BottomTabBar.tsx` — add `/command-center` to TAB_GROUPS and SHEET_ITEMS
- `apps/web/src/router.tsx` — add `/command-center` route

**Create:**
- `apps/web/src/pages/CommandCenter.tsx` — new page for military ships (ship_combat category)

---

### Task 1: DB schema — add facilityId column + migration

**Files:**
- Modify: `packages/db/src/schema/build-queue.ts`

- [ ] **Step 1: Add facilityId column to buildQueue schema**

In `packages/db/src/schema/build-queue.ts`, add `facilityId` to the `buildQueue` table definition, after the `status` column:

```ts
  facilityId: varchar('facility_id', { length: 64 }),
```

This is a nullable varchar — no default needed. Existing rows (building/research) will have `null`.

- [ ] **Step 2: Generate the Drizzle migration**

Run:

```bash
cd /Users/julienaubree/_projet/exilium && npx drizzle-kit generate
```

Expected: A new migration file in `packages/db/drizzle/` adding the `facility_id` column.

- [ ] **Step 3: Apply the migration**

Run:

```bash
cd /Users/julienaubree/_projet/exilium && npx drizzle-kit push
```

Expected: Column added to database without errors.

- [ ] **Step 4: TS check**

Run: `cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p packages/db/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit and push**

```bash
cd /Users/julienaubree/_projet/exilium && git add packages/db/src/schema/build-queue.ts packages/db/drizzle/ && git commit -m "feat: add facilityId column to buildQueue schema

Nullable varchar column to identify production building (shipyard, commandCenter, arsenal).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" && git push
```

---

### Task 2: Backend — update shipyard service + router for facilityId

**Files:**
- Modify: `apps/api/src/modules/shipyard/shipyard.service.ts`
- Modify: `apps/api/src/modules/shipyard/shipyard.router.ts`

- [ ] **Step 1: Add getFacilityId helper in shipyard.service.ts**

Inside the `createShipyardService` factory function, before the `return {` statement (before line 29), add:

```ts
  function getFacilityId(
    type: 'ship' | 'defense',
    itemId: string,
    config: { ships: Record<string, any>; defenses: Record<string, any> },
  ): string {
    if (type === 'defense') return 'arsenal';
    const shipDef = config.ships[itemId];
    const firstBuildingPrereq = shipDef?.prerequisites?.buildings?.[0]?.buildingId;
    return firstBuildingPrereq ?? 'shipyard';
  }
```

- [ ] **Step 2: Update getShipyardQueue to accept optional facilityId**

Change the method signature at line 109 from:

```ts
    async getShipyardQueue(planetId: string) {
```

to:

```ts
    async getShipyardQueue(planetId: string, facilityId?: string) {
```

Replace the body (lines 110-119) with:

```ts
      const conditions = [
        eq(buildQueue.planetId, planetId),
        inArray(buildQueue.status, ['active', 'queued']),
      ];
      if (facilityId) {
        conditions.push(eq(buildQueue.facilityId, facilityId));
      }
      return db
        .select()
        .from(buildQueue)
        .where(and(...conditions))
        .then((rows) =>
          facilityId
            ? rows
            : rows.filter((r) => r.type === 'ship' || r.type === 'defense'),
        );
```

Note: When `facilityId` is provided, SQL does all the filtering. When absent (backward compat), in-memory filter for ship/defense remains.

- [ ] **Step 3: Update startBuild to compute and use facilityId**

In the `startBuild` method:

1. After the `const config = await gameConfigService.getFullConfig();` line (~line 130), add:

```ts
      const facilityId = getFacilityId(type, itemId, config);
```

2. Change the `sameTypeQueue` line (~line 160) from:

```ts
      const sameTypeQueue = existingActive.filter((e) => e.type === type);
```

to:

```ts
      const sameTypeQueue = existingActive.filter((e) => e.facilityId === facilityId);
```

3. In the `db.insert(buildQueue).values({...})` call (~lines 193-206), add `facilityId` to the values object:

```ts
        .values({
          planetId,
          userId,
          type,
          itemId,
          quantity,
          completedCount: 0,
          startTime,
          endTime,
          status,
          facilityId,
        })
```

- [ ] **Step 4: Update activateNextBatch to accept facilityId**

Change the method signature at line 331 from:

```ts
    async activateNextBatch(planetId: string, type: 'ship' | 'defense') {
```

to:

```ts
    async activateNextBatch(planetId: string, type: 'ship' | 'defense', facilityId?: string | null) {
```

In the `where` clause (~lines 335-341), add the facilityId condition. Replace:

```ts
        .where(
          and(
            eq(buildQueue.planetId, planetId),
            eq(buildQueue.status, 'queued'),
            eq(buildQueue.type, type),
          ),
        )
```

with:

```ts
        .where(
          and(
            eq(buildQueue.planetId, planetId),
            eq(buildQueue.status, 'queued'),
            eq(buildQueue.type, type),
            ...(facilityId ? [eq(buildQueue.facilityId, facilityId)] : []),
          ),
        )
```

- [ ] **Step 5: Update completeUnit to pass facilityId**

In the `completeUnit` method, change the call at line 261 from:

```ts
        await this.activateNextBatch(entry.planetId, entry.type as 'ship' | 'defense');
```

to:

```ts
        await this.activateNextBatch(entry.planetId, entry.type as 'ship' | 'defense', entry.facilityId);
```

- [ ] **Step 6: Update cancelBatch to pass facilityId**

In the `cancelBatch` method, change the call at line 454 from:

```ts
        await this.activateNextBatch(planetId, entry.type as 'ship' | 'defense');
```

to:

```ts
        await this.activateNextBatch(planetId, entry.type as 'ship' | 'defense', entry.facilityId);
```

- [ ] **Step 7: Update shipyard.router.ts queue input**

In `apps/api/src/modules/shipyard/shipyard.router.ts`, update the `queue` procedure input (line 20) from:

```ts
      .input(z.object({ planetId: z.string().uuid() }))
```

to:

```ts
      .input(z.object({
        planetId: z.string().uuid(),
        facilityId: z.enum(['shipyard', 'commandCenter', 'arsenal']).optional(),
      }))
```

And update the handler (line 22) from:

```ts
        return shipyardService.getShipyardQueue(input.planetId);
```

to:

```ts
        return shipyardService.getShipyardQueue(input.planetId, input.facilityId);
```

- [ ] **Step 8: TS check**

Run: `cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: No errors

- [ ] **Step 9: Commit and push**

```bash
cd /Users/julienaubree/_projet/exilium && git add apps/api/src/modules/shipyard/shipyard.service.ts apps/api/src/modules/shipyard/shipyard.router.ts && git commit -m "feat: add facilityId-based queue separation in shipyard service

Each production building gets its own independent queue. Ships are assigned
to shipyard or commandCenter based on their first building prerequisite.
Defenses use arsenal. Queue operations filter by facilityId for parallel production.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" && git push
```

---

### Task 3: Frontend — CommandCenter page, Shipyard filter update, navigation

**Files:**
- Modify: `apps/web/src/lib/icons.tsx`
- Create: `apps/web/src/pages/CommandCenter.tsx`
- Modify: `apps/web/src/pages/Shipyard.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Modify: `apps/web/src/components/layout/BottomTabBar.tsx`
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Add CommandCenterIcon to icons.tsx**

In `apps/web/src/lib/icons.tsx`, add a new icon export (near the other icons):

```tsx
export function CommandCenterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
    </Icon>
  );
}
```

This is a crosshair/targeting reticle icon — fits the military theme.

- [ ] **Step 2: Create CommandCenter.tsx page**

Create `apps/web/src/pages/CommandCenter.tsx` as a copy of `Shipyard.tsx` with these differences:

```tsx
import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResourceCost } from '@/components/common/ResourceCost';
import { Timer } from '@/components/common/Timer';
import { GameImage } from '@/components/common/GameImage';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatDuration } from '@/lib/format';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { EntityDetailOverlay } from '@/components/common/EntityDetailOverlay';
import { ShipDetailContent } from '@/components/entity-details/ShipDetailContent';
import { getShipName } from '@/lib/entity-names';
import { useGameConfig } from '@/hooks/useGameConfig';


export default function CommandCenter() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const utils = trpc.useUtils();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const { data: gameConfig } = useGameConfig();

  const shipCategories = (gameConfig?.categories ?? [])
    .filter((c) => c.entityType === 'ship' && c.id === 'ship_combat')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const { data: ships, isLoading } = trpc.shipyard.ships.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: resourceData } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const resources = useResourceCounter(
    resourceData
      ? {
          minerai: resourceData.minerai,
          silicium: resourceData.silicium,
          hydrogene: resourceData.hydrogene,
          resourcesUpdatedAt: resourceData.resourcesUpdatedAt,
          mineraiPerHour: resourceData.rates.mineraiPerHour,
          siliciumPerHour: resourceData.rates.siliciumPerHour,
          hydrogenePerHour: resourceData.rates.hydrogenePerHour,
          storageMineraiCapacity: resourceData.rates.storageMineraiCapacity,
          storageSiliciumCapacity: resourceData.rates.storageSiliciumCapacity,
          storageHydrogeneCapacity: resourceData.rates.storageHydrogeneCapacity,
        }
      : undefined,
  );

  const { data: queue } = trpc.shipyard.queue.useQuery(
    { planetId: planetId!, facilityId: 'commandCenter' },
    { enabled: !!planetId },
  );

  const { data: researchList } = trpc.research.list.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const researchLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    researchList?.forEach((r) => { levels[r.id] = r.currentLevel; });
    return levels;
  }, [researchList]);

  const buildMutation = trpc.shipyard.buildShip.useMutation({
    onSuccess: () => {
      utils.shipyard.ships.invalidate({ planetId: planetId! });
      utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'commandCenter' });
      utils.resource.production.invalidate({ planetId: planetId! });
    },
  });

  const cancelMutation = trpc.shipyard.cancelBatch.useMutation({
    onSuccess: () => {
      utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'commandCenter' });
      utils.shipyard.ships.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
      setCancelConfirm(null);
    },
  });

  const shipQueue = queue ?? [];

  if (isLoading || !ships) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Centre de commandement" />
        <CardGridSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Centre de commandement" />

      {shipQueue.length > 0 && (
        <section className="glass-card p-4">
          <h2 className="text-base font-semibold mb-3">File de construction</h2>
          <div className="space-y-3">
            {shipQueue.map((item) => {
              const name = getShipName(item.itemId, gameConfig);
              const remaining = item.quantity - (item.completedCount ?? 0);
              return (
                <div key={item.id} className="space-y-1 border-l-4 border-l-orange-500 pl-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>{remaining}x {name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setCancelConfirm(item.id)}
                      disabled={cancelMutation.isPending}
                    >
                      Annuler
                    </Button>
                  </div>
                  {item.status === 'active' && item.endTime && (
                    <Timer
                      endTime={new Date(item.endTime)}
                      totalDuration={Math.floor((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 1000)}
                      onComplete={() => {
                        utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'commandCenter' });
                        utils.shipyard.ships.invalidate({ planetId: planetId! });
                      }}
                    />
                  )}
                  {item.status === 'queued' && (
                    <span className="text-xs text-muted-foreground">En attente</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {shipCategories.map((category) => {
        const categoryShips = ships.filter((s) =>
          gameConfig?.ships[s.id]?.categoryId === category.id,
        );
        if (categoryShips.length === 0) return null;
        const isCollapsed = collapsed[category.id] ?? false;

        return (
          <div key={category.id}>
            <button
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [category.id]: !prev[category.id] }))
              }
              className="flex w-full items-center justify-between py-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider"
            >
              <span>{category.name}</span>
              <svg
                className={`h-4 w-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {!isCollapsed && (
              <>
                {/* Mobile compact list */}
                <div className="space-y-1 lg:hidden">
                  {categoryShips.map((ship) => {
                    const qty = quantities[ship.id] || 1;
                    const totalCost = {
                      minerai: ship.cost.minerai * qty,
                      silicium: ship.cost.silicium * qty,
                      hydrogene: ship.cost.hydrogene * qty,
                    };
                    const canAfford =
                      resources.minerai >= totalCost.minerai &&
                      resources.silicium >= totalCost.silicium &&
                      resources.hydrogene >= totalCost.hydrogene;

                    return (
                      <button
                        key={ship.id}
                        onClick={() => setDetailId(ship.id)}
                        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent/50 transition-colors ${!ship.prerequisitesMet ? 'opacity-50' : ''}`}
                      >
                        <GameImage category="ships" id={ship.id} size="icon" alt={ship.name} className="h-8 w-8 rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{ship.name}</span>
                            <span className="text-xs text-muted-foreground">x{ship.count}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <ResourceCost minerai={ship.cost.minerai} silicium={ship.cost.silicium} hydrogene={ship.cost.hydrogene} />
                          </div>
                        </div>
                        {ship.prerequisitesMet && (
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              min={1}
                              max={9999}
                              value={qty}
                              onChange={(e) =>
                                setQuantities({ ...quantities, [ship.id]: Math.max(1, Number(e.target.value) || 1) })
                              }
                              className="w-14 h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              className="h-8 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                buildMutation.mutate({ planetId: planetId!, shipId: ship.id as any, quantity: qty });
                              }}
                              disabled={!canAfford || buildMutation.isPending}
                            >
                              +
                            </Button>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Desktop: vertical card grid */}
                <div className="hidden lg:grid lg:gap-4 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                  {categoryShips.map((ship) => {
                    const qty = quantities[ship.id] || 1;
                    const totalCost = {
                      minerai: ship.cost.minerai * qty,
                      silicium: ship.cost.silicium * qty,
                      hydrogene: ship.cost.hydrogene * qty,
                    };
                    const canAfford =
                      resources.minerai >= totalCost.minerai &&
                      resources.silicium >= totalCost.silicium &&
                      resources.hydrogene >= totalCost.hydrogene;

                    return (
                      <button
                        key={ship.id}
                        onClick={() => setDetailId(ship.id)}
                        className={`retro-card text-left cursor-pointer overflow-hidden flex flex-col ${!ship.prerequisitesMet ? 'opacity-50' : ''}`}
                      >
                        <div className="relative h-[130px] overflow-hidden">
                          <GameImage
                            category="ships"
                            id={ship.id}
                            size="full"
                            alt={ship.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 right-2 bg-slate-700/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            x{ship.count}
                          </span>
                        </div>

                        <div className="p-3 flex flex-col flex-1 gap-1.5">
                          <div className="text-[13px] font-semibold text-foreground truncate">
                            {ship.name}
                          </div>

                          <div className="flex-1" />

                          <ResourceCost
                            minerai={ship.cost.minerai}
                            silicium={ship.cost.silicium}
                            hydrogene={ship.cost.hydrogene}
                            currentMinerai={resources.minerai}
                            currentSilicium={resources.silicium}
                            currentHydrogene={resources.hydrogene}
                          />
                          <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            {formatDuration(ship.timePerUnit)}
                          </div>
                          {!ship.prerequisitesMet ? (
                            <div className="text-[10px] text-destructive">
                              Prerequis manquants
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="number"
                                min={1}
                                max={9999}
                                value={qty}
                                onChange={(e) =>
                                  setQuantities({ ...quantities, [ship.id]: Math.max(1, Number(e.target.value) || 1) })
                                }
                                className="w-14 h-7 text-xs"
                              />
                              <Button
                                variant="retro"
                                size="sm"
                                className="flex-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  buildMutation.mutate({ planetId: planetId!, shipId: ship.id as any, quantity: qty });
                                }}
                                disabled={!canAfford || buildMutation.isPending}
                              >
                                Construire
                              </Button>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}

      <EntityDetailOverlay
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detailId ? gameConfig?.ships[detailId]?.name ?? '' : ''}
      >
        {detailId && <ShipDetailContent shipId={detailId} researchLevels={researchLevels} maxTemp={resourceData?.maxTemp} isHomePlanet={resourceData?.planetClassId === 'homeworld'} />}
      </EntityDetailOverlay>

      <ConfirmDialog
        open={!!cancelConfirm}
        onConfirm={() => cancelConfirm && cancelMutation.mutate({ planetId: planetId!, batchId: cancelConfirm })}
        onCancel={() => setCancelConfirm(null)}
        title="Annuler la production ?"
        description="Les unites restantes seront annulees. Le remboursement est proportionnel au temps restant, plafonne a 70% des ressources investies. Les unites deja produites sont conservees."
        confirmLabel="Annuler la production"
        variant="destructive"
      />
    </div>
  );
}
```

Key differences from `Shipyard.tsx`:
- Title: "Centre de commandement"
- `shipCategories` filters to `c.id === 'ship_combat'` only
- Queue query: `{ planetId, facilityId: 'commandCenter' }`
- Queue invalidation uses `{ planetId, facilityId: 'commandCenter' }`
- `shipQueue = queue ?? []` (no in-memory filter needed, server filters by facilityId)

- [ ] **Step 3: Update Shipyard.tsx to filter and use facilityId**

In `apps/web/src/pages/Shipyard.tsx`, make 3 changes:

1. Change the `shipCategories` filter (line 29-31) from:

```ts
  const shipCategories = (gameConfig?.categories ?? [])
    .filter((c) => c.entityType === 'ship')
    .sort((a, b) => a.sortOrder - b.sortOrder);
```

to:

```ts
  const shipCategories = (gameConfig?.categories ?? [])
    .filter((c) => c.entityType === 'ship' && c.id !== 'ship_combat')
    .sort((a, b) => a.sortOrder - b.sortOrder);
```

2. Change the queue query (line 60-63) from:

```ts
  const { data: queue } = trpc.shipyard.queue.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );
```

to:

```ts
  const { data: queue } = trpc.shipyard.queue.useQuery(
    { planetId: planetId!, facilityId: 'shipyard' },
    { enabled: !!planetId },
  );
```

3. Change the `shipQueue` line (line 93) from:

```ts
  const shipQueue = (queue ?? []).filter((q) => q.type === 'ship');
```

to:

```ts
  const shipQueue = queue ?? [];
```

4. Update all `utils.shipyard.queue.invalidate` calls (lines 79, 86, 134) from:

```ts
      utils.shipyard.queue.invalidate({ planetId: planetId! });
```

to:

```ts
      utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'shipyard' });
```

- [ ] **Step 4: Add CommandCenterIcon import and entry to Sidebar.tsx**

In `apps/web/src/components/layout/Sidebar.tsx`:

1. Add `CommandCenterIcon` to the import (line 8):

```ts
import {
  OverviewIcon,
  ResourcesIcon,
  BuildingsIcon,
  ResearchIcon,
  ShipyardIcon,
  CommandCenterIcon,
  DefenseIcon,
  ...
} from '@/lib/icons';
```

2. In the `Base` section items array (after the Chantier spatial entry, line 43), add:

```ts
      { label: 'Centre de commandement', path: '/command-center', icon: CommandCenterIcon },
```

So the Base items become:
```ts
      { label: 'Ressources', path: '/resources', icon: ResourcesIcon },
      { label: 'Batiments', path: '/buildings', icon: BuildingsIcon },
      { label: 'Recherche', path: '/research', icon: ResearchIcon },
      { label: 'Chantier spatial', path: '/shipyard', icon: ShipyardIcon },
      { label: 'Centre de commandement', path: '/command-center', icon: CommandCenterIcon },
      { label: 'Defense', path: '/defense', icon: DefenseIcon },
```

- [ ] **Step 5: Update BottomTabBar.tsx with command-center route**

In `apps/web/src/components/layout/BottomTabBar.tsx`:

1. Add `CommandCenterIcon` to the imports (line 2):

```ts
import {
  ...
  ShipyardIcon,
  CommandCenterIcon,
  DefenseIcon,
  ...
} from '@/lib/icons';
```

2. Add `/command-center` to `TAB_GROUPS.base` (line 29):

```ts
  base: ['/resources', '/buildings', '/research', '/shipyard', '/command-center', '/defense'],
```

3. Add an entry to `SHEET_ITEMS.base` (after Chantier spatial, line 41):

```ts
    { label: 'Centre de commandement', path: '/command-center', icon: CommandCenterIcon },
```

- [ ] **Step 6: Add route to router.tsx**

In `apps/web/src/router.tsx`, add the command-center route after the shipyard route (after line 87):

```ts
      {
        path: 'command-center',
        lazy: lazyLoad(() => import('./pages/CommandCenter')),
        errorElement: <ErrorBoundary><RouteErrorFallback /></ErrorBoundary>,
      },
```

- [ ] **Step 7: TS check**

Run: `cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 8: Commit and push**

```bash
cd /Users/julienaubree/_projet/exilium && git add apps/web/src/pages/CommandCenter.tsx apps/web/src/pages/Shipyard.tsx apps/web/src/lib/icons.tsx apps/web/src/components/layout/Sidebar.tsx apps/web/src/components/layout/BottomTabBar.tsx apps/web/src/router.tsx && git commit -m "feat: add Centre de commandement page for military ships

New page at /command-center showing ship_combat category ships.
Shipyard page now filters to ship_transport + ship_utilitaire only.
Both pages use facilityId for independent queue filtering.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" && git push
```

---

### Task 4: Final verification

**Files:** None (verification only)

- [ ] **Step 1: TS check all projects**

Run: `cd /Users/julienaubree/_projet/exilium && npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 2: Run API tests**

Run: `cd /Users/julienaubree/_projet/exilium/apps/api && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run game-engine tests**

Run: `cd /Users/julienaubree/_projet/exilium/packages/game-engine && npx vitest run`
Expected: All tests pass
