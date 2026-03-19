# Unified Fleet Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-step fleet wizard with a single unified screen where mission type drives ship categorization, with PvE pre-fill support.

**Architecture:** Decompose the current monolithic `Fleet.tsx` into focused sub-components (`MissionSelector`, `FleetComposition`, `PveMissionBanner`, `FleetSummaryBar`). Add one backend endpoint (`pve.getMissionById`) for banner data. Use `SHIP_STATS` from `@ogame-clone/game-engine` for client-side cargo capacity calculation.

**Tech Stack:** React 18, TypeScript, tRPC (React Query), Tailwind CSS, `@ogame-clone/game-engine`

---

## Chunk 1: Backend + Mission Config

### Task 1: Add `pve.getMissionById` endpoint

**Files:**
- Modify: `apps/api/src/modules/pve/pve.service.ts`
- Modify: `apps/api/src/modules/pve/pve.router.ts`

- [ ] **Step 1: Add `getMissionById` to the PvE service**

In `apps/api/src/modules/pve/pve.service.ts`, add this method to the returned object (after `getMissions`):

```typescript
async getMissionById(userId: string, missionId: string) {
  const [mission] = await db.select().from(pveMissions)
    .where(and(
      eq(pveMissions.id, missionId),
      eq(pveMissions.userId, userId),
    ))
    .limit(1);
  return mission ?? null;
},
```

- [ ] **Step 2: Add the tRPC endpoint**

In `apps/api/src/modules/pve/pve.router.ts`, add after `getMissions`:

```typescript
getMissionById: protectedProcedure
  .input(z.object({ missionId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    return pveService.getMissionById(ctx.userId!, input.missionId);
  }),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/pve/pve.service.ts apps/api/src/modules/pve/pve.router.ts
git commit -m "feat(api): add pve.getMissionById endpoint for fleet page banner"
```

---

### Task 2: Create mission config constant

**Files:**
- Create: `apps/web/src/config/mission-config.ts`

This file centralizes all mission-specific UI logic: ship categorization, hints, labels, button text.

- [ ] **Step 1: Create the mission config file**

Create the `apps/web/src/config/` directory if it does not exist, then create `apps/web/src/config/mission-config.ts`:

```typescript
import { SHIP_STATS } from '@ogame-clone/game-engine';

export type Mission = 'transport' | 'station' | 'spy' | 'attack' | 'colonize' | 'recycle' | 'mine' | 'pirate';

const COMBAT_SHIPS = ['lightFighter', 'heavyFighter', 'cruiser', 'battleship'] as const;

interface MissionConfig {
  label: string;
  hint: string;
  buttonLabel: string;
  dangerous: boolean;
  /** Ships that MUST be selected (at least 1). null = no requirement. */
  requiredShips: readonly string[] | null;
  /** If true, ONLY requiredShips can be sent (no optionals). */
  exclusive: boolean;
  /** Ships shown in "Recommended" section when there are no requiredShips. */
  recommendedShips: readonly string[] | null;
  /** Requires a pveMissionId (can only be launched from Missions page). */
  requiresPveMission: boolean;
}

export const MISSION_CONFIG: Record<Mission, MissionConfig> = {
  transport: {
    label: 'Transport',
    hint: 'Envoyez des ressources vers une planète alliée',
    buttonLabel: 'Envoyer',
    dangerous: false,
    requiredShips: null,
    exclusive: false,
    recommendedShips: ['smallCargo', 'largeCargo'],
    requiresPveMission: false,
  },
  station: {
    label: 'Stationner',
    hint: 'Stationnez votre flotte sur une planète alliée',
    buttonLabel: 'Envoyer',
    dangerous: false,
    requiredShips: null,
    exclusive: false,
    recommendedShips: null,
    requiresPveMission: false,
  },
  spy: {
    label: 'Espionner',
    hint: "Envoyez des sondes d'espionnage",
    buttonLabel: 'Espionner',
    dangerous: false,
    requiredShips: ['espionageProbe'],
    exclusive: true,
    recommendedShips: null,
    requiresPveMission: false,
  },
  attack: {
    label: 'Attaque',
    hint: 'Attaquez une planète ennemie',
    buttonLabel: 'Attaquer',
    dangerous: true,
    requiredShips: [...COMBAT_SHIPS],
    exclusive: false,
    recommendedShips: null,
    requiresPveMission: false,
  },
  colonize: {
    label: 'Coloniser',
    hint: 'Colonisez une position vide',
    buttonLabel: 'Coloniser',
    dangerous: true,
    requiredShips: ['colonyShip'],
    exclusive: true,
    recommendedShips: null,
    requiresPveMission: false,
  },
  recycle: {
    label: 'Recycler',
    hint: 'Récupérez les débris en orbite',
    buttonLabel: 'Recycler',
    dangerous: false,
    requiredShips: ['recycler'],
    exclusive: true,
    recommendedShips: null,
    requiresPveMission: false,
  },
  mine: {
    label: 'Miner',
    hint: "Envoyez des prospecteurs sur une ceinture d'astéroïdes",
    buttonLabel: 'Envoyer',
    dangerous: false,
    requiredShips: ['prospector'],
    exclusive: false,
    recommendedShips: null,
    requiresPveMission: false,
  },
  pirate: {
    label: 'Pirate',
    hint: 'Attaquez un repaire pirate',
    buttonLabel: 'Attaquer',
    dangerous: true,
    requiredShips: [...COMBAT_SHIPS],
    exclusive: false,
    recommendedShips: null,
    requiresPveMission: true,
  },
};

export type ShipCategory = 'required' | 'optional' | 'disabled';

/**
 * Compute total cargo capacity for a fleet composition.
 */
export function getCargoCapacity(selectedShips: Record<string, number>): number {
  return Object.entries(selectedShips).reduce((sum, [id, count]) => {
    const stats = SHIP_STATS[id as keyof typeof SHIP_STATS];
    return sum + (stats ? stats.cargoCapacity * count : 0);
  }, 0);
}

/**
 * Categorize a ship for a given mission.
 * @param shipId - The ship identifier
 * @param shipCount - Number available on the planet
 * @param mission - The selected mission type
 */
export function categorizeShip(
  shipId: string,
  shipCount: number,
  mission: Mission,
): ShipCategory {
  const config = MISSION_CONFIG[mission];

  if (shipCount === 0) return 'disabled';

  if (config.exclusive && config.requiredShips) {
    return config.requiredShips.includes(shipId) ? 'required' : 'disabled';
  }

  if (config.requiredShips?.includes(shipId)) return 'required';

  // Recommended ships reuse the 'required' category so they appear in the highlighted
  // section at the top. The FleetComposition component displays the section header as
  // "★ Recommandés" (not "★ Requis") when config.requiredShips is null.
  if (config.recommendedShips?.includes(shipId)) return 'required';

  return 'optional';
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/config/mission-config.ts
git commit -m "feat(web): add mission config with ship categorization logic"
```

---

## Chunk 2: Sub-components

> **Note:** Create the `apps/web/src/components/fleet/` directory before starting Task 3.

### Task 3: Create `MissionSelector` component

**Files:**
- Create: `apps/web/src/components/fleet/MissionSelector.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/fleet/MissionSelector.tsx`:

```typescript
import { cn } from '@/lib/utils';
import { MISSION_CONFIG, type Mission } from '@/config/mission-config';

interface MissionSelectorProps {
  selected: Mission | null;
  onChange: (mission: Mission) => void;
  locked: boolean;
}

const MISSIONS: Mission[] = ['transport', 'station', 'spy', 'attack', 'colonize', 'recycle', 'mine', 'pirate'];

export function MissionSelector({ selected, onChange, locked }: MissionSelectorProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase text-muted-foreground">Mission</span>
        {locked && (
          <span className="text-xs text-yellow-500">🔒 Verrouillée pour cette mission</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MISSIONS.map((m) => {
          const config = MISSION_CONFIG[m];
          const isSelected = selected === m;
          return (
            <button
              key={m}
              onClick={() => !locked && onChange(m)}
              disabled={locked && !isSelected}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                isSelected
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                  : locked
                    ? 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer',
              )}
            >
              {isSelected && '✓ '}{config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/fleet/MissionSelector.tsx
git commit -m "feat(web): add MissionSelector component"
```

---

### Task 4: Create `PveMissionBanner` component

**Files:**
- Create: `apps/web/src/components/fleet/PveMissionBanner.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/fleet/PveMissionBanner.tsx`:

```typescript
import { trpc } from '@/trpc';
import { Badge } from '@/components/ui/badge';

interface PveMissionBannerProps {
  pveMissionId: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-900/50 text-green-300 border-green-700',
  medium: 'bg-orange-900/50 text-orange-300 border-orange-700',
  hard: 'bg-red-900/50 text-red-300 border-red-700',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

export function PveMissionBanner({ pveMissionId }: PveMissionBannerProps) {
  const { data: mission } = trpc.pve.getMissionById.useQuery(
    { missionId: pveMissionId },
    { staleTime: 60_000 },
  );

  if (!mission) return null;

  const params = mission.parameters as Record<string, unknown>;
  const rewards = mission.rewards as Record<string, unknown>;
  const coords = `[${params.galaxy}:${params.system}:${params.position}]`;

  if (mission.missionType === 'mine') {
    const resourceType = (params.resourceType ?? rewards.resourceType) as string;
    const estimatedQty = rewards.estimatedQuantity as number | undefined;
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-800/60 bg-blue-950/40 p-3">
        <span className="text-xl">⛏</span>
        <div>
          <div className="text-sm font-semibold text-blue-300">Extraction minière</div>
          <div className="text-xs text-blue-400/80">
            {resourceType}{estimatedQty ? ` — ~${estimatedQty.toLocaleString()} unités` : ''} — Ceinture {coords}
          </div>
        </div>
      </div>
    );
  }

  // Pirate mission
  const tier = mission.difficultyTier ?? 'easy';
  const minerai = (rewards.minerai as number) ?? 0;
  const silicium = (rewards.silicium as number) ?? 0;
  const hydrogene = (rewards.hydrogene as number) ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-800/60 bg-red-950/40 p-3">
      <span className="text-xl">☠</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-red-300">Repaire pirate</span>
          <Badge className={DIFFICULTY_COLORS[tier]}>{DIFFICULTY_LABELS[tier]}</Badge>
        </div>
        <div className="text-xs text-red-400/80">
          {coords} — Récompense : {minerai.toLocaleString()} minerai, {silicium.toLocaleString()} silicium, {hydrogene.toLocaleString()} H₂
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/fleet/PveMissionBanner.tsx
git commit -m "feat(web): add PveMissionBanner component"
```

---

### Task 5: Create `FleetComposition` component

**Files:**
- Create: `apps/web/src/components/fleet/FleetComposition.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/fleet/FleetComposition.tsx`:

```typescript
import { Input } from '@/components/ui/input';
import { categorizeShip, type Mission, type ShipCategory, MISSION_CONFIG } from '@/config/mission-config';

interface Ship {
  id: string;
  name: string;
  count: number;
}

interface FleetCompositionProps {
  ships: Ship[];
  mission: Mission | null;
  selectedShips: Record<string, number>;
  onChange: (shipId: string, count: number) => void;
}

function ShipRow({ ship, value, onChange, disabled }: {
  ship: Ship;
  value: number;
  onChange: (count: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded bg-background/50 px-3 py-1.5">
      <span className={`text-sm ${disabled ? 'text-muted-foreground/40' : ''}`}>{ship.name}</span>
      <div className="flex items-center gap-2">
        {!disabled && ship.count > 0 && (
          <button
            onClick={() => onChange(ship.count)}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            MAX
          </button>
        )}
        {disabled ? (
          <span className="text-xs text-muted-foreground/40">
            {ship.count === 0 ? '0 dispo' : 'non disponible'}
          </span>
        ) : (
          <>
            <Input
              type="number"
              min={0}
              max={ship.count}
              value={value}
              onChange={(e) => onChange(Math.min(Number(e.target.value) || 0, ship.count))}
              className="h-7 w-20 text-center text-sm"
            />
            <span className="text-xs text-muted-foreground">/{ship.count}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function FleetComposition({ ships, mission, selectedShips, onChange }: FleetCompositionProps) {
  if (!mission) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Sélectionnez une mission pour voir les vaisseaux disponibles
      </div>
    );
  }

  const config = MISSION_CONFIG[mission];
  const categorized: Record<ShipCategory, Ship[]> = { required: [], optional: [], disabled: [] };

  for (const ship of ships) {
    const category = categorizeShip(ship.id, ship.count, mission);
    categorized[category].push(ship);
  }

  const sectionLabel = config.requiredShips ? '★ Requis' : '★ Recommandés';
  const showRequired = categorized.required.length > 0;

  return (
    <div className="space-y-2">
      {/* Required / Recommended */}
      {showRequired && (
        <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
          <div className="mb-2 text-xs font-medium uppercase text-emerald-400">{sectionLabel}</div>
          <div className="space-y-1">
            {categorized.required.map((ship) => (
              <ShipRow
                key={ship.id}
                ship={ship}
                value={selectedShips[ship.id] ?? 0}
                onChange={(count) => onChange(ship.id, count)}
                disabled={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Optional */}
      {categorized.optional.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Optionnels</div>
          <div className="space-y-1">
            {categorized.optional.map((ship) => (
              <ShipRow
                key={ship.id}
                ship={ship}
                value={selectedShips[ship.id] ?? 0}
                onChange={(count) => onChange(ship.id, count)}
                disabled={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* Disabled */}
      {categorized.disabled.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-3 opacity-50">
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">Non disponibles</div>
          <div className="space-y-1">
            {categorized.disabled.map((ship) => (
              <ShipRow
                key={ship.id}
                ship={ship}
                value={0}
                onChange={() => {}}
                disabled
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/fleet/FleetComposition.tsx
git commit -m "feat(web): add FleetComposition component with 3-section ship categorization"
```

---

### Task 6: Create `FleetSummaryBar` component

**Files:**
- Create: `apps/web/src/components/fleet/FleetSummaryBar.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/fleet/FleetSummaryBar.tsx`:

```typescript
import { Button } from '@/components/ui/button';
import type { Mission } from '@/config/mission-config';
import { MISSION_CONFIG } from '@/config/mission-config';

interface FleetSummaryBarProps {
  mission: Mission | null;
  selectedShips: Record<string, number>;
  totalCargo: number;
  cargoCapacity: number;
  disabled: boolean;
  sending: boolean;
  onSend: () => void;
}

export function FleetSummaryBar({ mission, selectedShips, totalCargo, cargoCapacity, disabled, sending, onSend }: FleetSummaryBarProps) {
  const shipCount = Object.values(selectedShips).reduce((sum, n) => sum + n, 0);

  const config = mission ? MISSION_CONFIG[mission] : null;
  const buttonLabel = config?.buttonLabel ?? 'Envoyer';

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">
        {shipCount > 0 ? (
          <>
            {shipCount} vaisseau{shipCount > 1 ? 'x' : ''} &bull; Cargo : {totalCargo.toLocaleString()}/{cargoCapacity.toLocaleString()}
          </>
        ) : (
          'Aucun vaisseau sélectionné'
        )}
      </div>
      <Button
        size="sm"
        disabled={disabled || sending}
        onClick={onSend}
        variant={config?.dangerous ? 'destructive' : 'default'}
      >
        {sending ? 'Envoi...' : buttonLabel}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/fleet/FleetSummaryBar.tsx
git commit -m "feat(web): add FleetSummaryBar component"
```

---

## Chunk 3: Fleet page rewrite

### Task 7: Rewrite `Fleet.tsx` as unified single-screen

**Files:**
- Modify: `apps/web/src/pages/Fleet.tsx` (full rewrite)

This task replaces the entire 3-step wizard with the unified layout. It composes all sub-components created in Tasks 3-6.

- [ ] **Step 1: Rewrite Fleet.tsx**

Replace the entire content of `apps/web/src/pages/Fleet.tsx` with:

```typescript
import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams } from 'react-router';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { trpc } from '@/trpc';
import { useToastStore } from '@/stores/toast.store';
import { MissionSelector } from '@/components/fleet/MissionSelector';
import { PveMissionBanner } from '@/components/fleet/PveMissionBanner';
import { FleetComposition } from '@/components/fleet/FleetComposition';
import { FleetSummaryBar } from '@/components/fleet/FleetSummaryBar';
import { MISSION_CONFIG, getCargoCapacity, type Mission } from '@/config/mission-config';

export default function Fleet() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const [searchParams, setSearchParams] = useSearchParams();

  // Core state
  const [mission, setMission] = useState<Mission | null>(null);
  const [target, setTarget] = useState({ galaxy: 1, system: 1, position: 1 });
  const [selectedShips, setSelectedShips] = useState<Record<string, number>>({});
  const [cargo, setCargo] = useState({ minerai: 0, silicium: 0, hydrogene: 0 });
  const [confirmSend, setConfirmSend] = useState(false);

  // PvE mode
  const [pveMissionId, setPveMissionId] = useState<string | null>(null);
  const [pveMode, setPveMode] = useState(false);
  const prefillRef = useRef<{ mission: Mission; galaxy: number; system: number; position: number } | null>(null);

  // Data queries
  const { data: ships, isLoading } = trpc.shipyard.ships.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: planets } = trpc.planet.list.useQuery();
  const planet = planets?.find((p) => p.id === planetId);

  // URL param handling — runs once on mount
  useEffect(() => {
    const paramMission = searchParams.get('mission') as Mission | null;
    if (!paramMission) {
      // Default target to current planet coordinates
      if (planet) {
        setTarget({ galaxy: planet.galaxy, system: planet.system, position: planet.position });
      }
      return;
    }

    const data = {
      mission: paramMission,
      galaxy: Number(searchParams.get('galaxy')) || 1,
      system: Number(searchParams.get('system')) || 1,
      position: Number(searchParams.get('position')) || 1,
    };

    const paramPveMissionId = searchParams.get('pveMissionId');
    if (paramPveMissionId) {
      setPveMissionId(paramPveMissionId);
      setPveMode(true);
    }

    prefillRef.current = data;
    setTarget({ galaxy: data.galaxy, system: data.system, position: data.position });
    setMission(data.mission);
    setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select ships when data loads (PvE prefill)
  useEffect(() => {
    if (!ships || !prefillRef.current) return;
    const missionType = prefillRef.current.mission;
    const config = MISSION_CONFIG[missionType];

    if (config.requiredShips) {
      const preselect: Record<string, number> = {};
      for (const shipId of config.requiredShips) {
        const ship = ships.find((s) => s.id === shipId);
        if (ship && ship.count > 0) preselect[shipId] = ship.count;
      }
      setSelectedShips(preselect);
    }

    prefillRef.current = null;
  }, [ships]);

  // Send mutation
  const sendMutation = trpc.fleet.send.useMutation({
    onSuccess: () => {
      addToast('Flotte envoyée !', 'success');
      utils.shipyard.ships.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
      // Reset all state
      setMission(null);
      setSelectedShips({});
      setCargo({ minerai: 0, silicium: 0, hydrogene: 0 });
      setConfirmSend(false);
      setPveMissionId(null);
      setPveMode(false);
      if (planet) {
        setTarget({ galaxy: planet.galaxy, system: planet.system, position: planet.position });
      }
    },
  });

  const handleSend = () => {
    if (!mission || !planetId) return;
    sendMutation.mutate({
      originPlanetId: planetId,
      targetGalaxy: target.galaxy,
      targetSystem: target.system,
      targetPosition: target.position,
      mission,
      ships: Object.fromEntries(Object.entries(selectedShips).filter(([, c]) => c > 0)),
      mineraiCargo: cargo.minerai,
      siliciumCargo: cargo.silicium,
      hydrogeneCargo: cargo.hydrogene,
      ...(pveMissionId ? { pveMissionId } : {}),
    });
  };

  const handleShipChange = (shipId: string, count: number) => {
    setSelectedShips((prev) => ({ ...prev, [shipId]: count }));
  };

  const handleMissionChange = (m: Mission) => {
    setMission(m);
    // Reset ships when mission changes (categories shift)
    setSelectedShips({});
  };

  // Validation
  const getValidationError = (): string | null => {
    if (!mission) return 'Sélectionnez une mission';
    if (!target.galaxy || !target.system || !target.position) return 'Destination incomplète';

    const config = MISSION_CONFIG[mission];
    const selected = Object.entries(selectedShips).filter(([, c]) => c > 0);
    if (selected.length === 0) return 'Sélectionnez au moins un vaisseau';

    if (config.requiredShips && !config.recommendedShips) {
      const hasRequired = config.requiredShips.some((id) => (selectedShips[id] ?? 0) > 0);
      if (!hasRequired) {
        const names = config.requiredShips.join(', ');
        return `Cette mission nécessite : ${names}`;
      }
    }

    // Check total cargo does not exceed capacity
    const totalCargo = cargo.minerai + cargo.silicium + cargo.hydrogene;
    if (totalCargo > cargoCapacity) return 'Cargo dépasse la capacité';

    return null;
  };

  const totalCargo = cargo.minerai + cargo.silicium + cargo.hydrogene;
  const cargoCapacity = getCargoCapacity(selectedShips);
  const validationError = getValidationError();

  if (isLoading) return <CardGridSkeleton />;

  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-4">
      <PageHeader title="Flotte" />

      {/* PvE Mission Banner */}
      {pveMissionId && <PveMissionBanner pveMissionId={pveMissionId} />}

      {/* Mission Selector */}
      <MissionSelector
        selected={mission}
        onChange={handleMissionChange}
        locked={pveMode}
      />

      {/* Destination */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">Cible :</span>
        <Input
          type="number"
          min={1}
          max={9}
          value={target.galaxy}
          onChange={(e) => setTarget((t) => ({ ...t, galaxy: Number(e.target.value) || 1 }))}
          disabled={pveMode}
          className="h-8 w-14 text-center"
        />
        <span className="text-muted-foreground">:</span>
        <Input
          type="number"
          min={1}
          max={499}
          value={target.system}
          onChange={(e) => setTarget((t) => ({ ...t, system: Number(e.target.value) || 1 }))}
          disabled={pveMode}
          className="h-8 w-16 text-center"
        />
        <span className="text-muted-foreground">:</span>
        <Input
          type="number"
          min={1}
          max={16}
          value={target.position}
          onChange={(e) => setTarget((t) => ({ ...t, position: Number(e.target.value) || 1 }))}
          disabled={pveMode}
          className="h-8 w-14 text-center"
        />
        {pveMode && <span className="text-xs text-yellow-500">🔒</span>}
      </div>

      {/* Mission Hint (only in direct mode, not PvE — banner replaces it) */}
      {mission && !pveMode && (
        <div className="rounded-lg border border-blue-800/40 bg-blue-950/30 p-2 text-center text-xs text-blue-300">
          {MISSION_CONFIG[mission].hint}
        </div>
      )}

      {/* Fleet Composition */}
      <FleetComposition
        ships={ships ?? []}
        mission={mission}
        selectedShips={selectedShips}
        onChange={handleShipChange}
      />

      {/* Cargo */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase text-muted-foreground">Cargo</span>
          <span className="text-xs text-muted-foreground">
            {totalCargo.toLocaleString()} / {cargoCapacity.toLocaleString()}
          </span>
        </div>
        <div className="flex gap-2">
          {(['minerai', 'silicium', 'hydrogene'] as const).map((res) => (
            <div key={res} className="flex-1 text-center">
              <div className="mb-1 text-[10px] text-muted-foreground capitalize">{res === 'hydrogene' ? 'Hydrogène' : res.charAt(0).toUpperCase() + res.slice(1)}</div>
              <Input
                type="number"
                min={0}
                value={cargo[res]}
                onChange={(e) => setCargo((c) => ({ ...c, [res]: Math.max(0, Number(e.target.value) || 0) }))}
                className="h-7 text-center text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Validation Error */}
      {validationError && mission && (
        <div className="text-center text-xs text-yellow-400">{validationError}</div>
      )}

      {/* Server Error */}
      {sendMutation.error && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {sendMutation.error.message}
        </div>
      )}

      {/* Summary Bar */}
      <FleetSummaryBar
        mission={mission}
        selectedShips={selectedShips}
        totalCargo={totalCargo}
        cargoCapacity={cargoCapacity}
        disabled={!!validationError}
        sending={sendMutation.isPending}
        onSend={() => {
          if (mission && MISSION_CONFIG[mission].dangerous) {
            setConfirmSend(true);
          } else {
            handleSend();
          }
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmSend}
        onConfirm={() => { setConfirmSend(false); handleSend(); }}
        onCancel={() => setConfirmSend(false)}
        title={`Confirmer la mission ${mission ? MISSION_CONFIG[mission].label : ''} ?`}
        description={`Vous êtes sur le point d'envoyer votre flotte en mission ${mission ? MISSION_CONFIG[mission].label.toLowerCase() : ''} vers [${target.galaxy}:${target.system}:${target.position}].`}
        variant="destructive"
        confirmLabel="Envoyer"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors

- [ ] **Step 3: Test manually in browser**

1. Navigate to `/fleet` directly — should see mission chips, empty destination, "Sélectionnez une mission" placeholder
2. Select "Transport" — should see ships categorized (cargos in Recommandés, others in Optionnels)
3. Navigate from Missions page via a mining mission link — should see banner, locked mission/destination, prospectors pre-selected
4. Send a fleet — should succeed, form resets

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Fleet.tsx
git commit -m "feat(web): rewrite Fleet page as unified single-screen with mission-driven ship categorization"
```

---

### Task 8: Cleanup and verify

**Files:**
- Verify: all files compile and work together

- [ ] **Step 1: Build packages**

```bash
pnpm --filter @ogame-clone/db build && pnpm --filter @ogame-clone/game-engine build
```

- [ ] **Step 2: TypeScript check all apps**

```bash
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: no errors in either

- [ ] **Step 3: Run game-engine tests**

```bash
pnpm --filter game-engine test
```

Expected: all tests pass (no changes to game-engine code)

- [ ] **Step 4: Verify `SHIP_STATS` is exported from game-engine**

```bash
grep -n "export.*SHIP_STATS" packages/game-engine/src/constants/ship-stats.ts
grep -n "ship-stats" packages/game-engine/src/index.ts
```

If `SHIP_STATS` is not re-exported from `index.ts`, add:
```typescript
export { SHIP_STATS } from './constants/ship-stats.js';
export type { ShipId, ShipStats } from './constants/ship-stats.js';
```

- [ ] **Step 5: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: ensure SHIP_STATS export and final cleanup"
```
