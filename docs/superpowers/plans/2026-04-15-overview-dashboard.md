# Overview Dashboard Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the planet Overview page into a dense, actionable dashboard with immersive hero banner, KPI bar with expandable panels, activity slots, and a 2x2 info grid.

**Architecture:** Decompose the monolithic 1200-line `Overview.tsx` into 7 focused components. Reuse EmpireKpiBar's toggle pattern for the new KPI bar. No new tRPC queries needed — all data sources already exist.

**Tech Stack:** React, TypeScript, Tailwind CSS, tRPC, existing game components (Timer, GameImage, BiomeBadge, ResourceGauge)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `apps/web/src/components/overview/OverviewHero.tsx` | **Create** — Compact hero banner with planet image background, thumbnail, name, coords, biomes |
| `apps/web/src/components/overview/OverviewKpiBar.tsx` | **Create** — KPI bar with resource/energy/fleet pills and expandable detail panels |
| `apps/web/src/components/overview/OverviewActivities.tsx` | **Create** — 3 horizontal activity slots (construction, shipyard, command center) |
| `apps/web/src/components/overview/AttackAlert.tsx` | **Create** — Hostile fleet alert banner (extracted from Overview.tsx) |
| `apps/web/src/components/overview/OverviewGrid.tsx` | **Create** — 2x2 grid: fleet, movements, defenses, flagship |
| `apps/web/src/components/overview/OverviewEvents.tsx` | **Create** — Collapsible recent events section |
| `apps/web/src/pages/Overview.tsx` | **Rewrite** — Slim orchestrator: queries + guards + renders child components |

---

### Task 1: OverviewHero — Compact hero banner

**Files:**
- Create: `apps/web/src/components/overview/OverviewHero.tsx`

- [ ] **Step 1: Create the OverviewHero component**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { FlagshipIcon } from '@/lib/icons';
import { getPlanetImageUrl } from '@/lib/assets';
import { EntityDetailOverlay } from '@/components/common/EntityDetailOverlay';
import { trpc } from '@/trpc';

// Reuse BiomeBadge from existing Overview — it will be extracted in the main page rewrite
// For now, accept biomes as render prop or inline

interface OverviewHeroProps {
  planet: {
    id: string;
    name: string;
    galaxy: number;
    system: number;
    position: number;
    diameter: number;
    minTemp: number;
    maxTemp: number;
    planetClassId: string | null;
    planetImageIndex: number | null;
    renamed: boolean;
    biomes?: Array<{ id: string; name: string; rarity: string; effects?: any[] }>;
  };
  flagshipOnPlanet: boolean;
  renderBiomeBadge: (biome: any) => React.ReactNode;
  renderPlanetDetail: (planet: any) => React.ReactNode;
}

export function OverviewHero({ planet, flagshipOnPlanet, renderBiomeBadge, renderPlanetDetail }: OverviewHeroProps) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  const renameMutation = trpc.planet.rename.useMutation({
    onSuccess: () => {
      utils.planet.list.invalidate();
      setIsRenaming(false);
    },
  });

  const biomes = planet.biomes ?? [];

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl -mx-4 -mt-4 lg:mx-0 lg:mt-0">
        {/* Background image */}
        <div className="absolute inset-0">
          {planet.planetClassId && planet.planetImageIndex != null ? (
            <img
              src={getPlanetImageUrl(planet.planetClassId, planet.planetImageIndex)}
              alt=""
              className="h-full w-full object-cover opacity-40 blur-sm scale-110"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-indigo-950 via-purple-900/60 to-slate-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>

        <div className="relative px-5 pt-6 pb-4 lg:px-8 lg:pt-8 lg:pb-5">
          <div className="flex items-start gap-4">
            {/* Thumbnail — clickable for detail overlay */}
            <button type="button" onClick={() => setShowDetail(true)} className="shrink-0 cursor-pointer group">
              {planet.planetClassId && planet.planetImageIndex != null ? (
                <img
                  src={getPlanetImageUrl(planet.planetClassId, planet.planetImageIndex, 'thumb')}
                  alt={planet.name}
                  className="h-12 w-12 rounded-full border-2 border-primary/30 object-cover shadow-lg shadow-primary/10 transition-all group-hover:ring-2 group-hover:ring-primary/40"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/30 bg-card text-lg font-bold text-primary shadow-lg shadow-primary/10">
                  {planet.name.charAt(0)}
                </div>
              )}
            </button>

            {/* Title + info */}
            <div className="flex-1 min-w-0 pt-0.5">
              {isRenaming ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newName.trim()) renameMutation.mutate({ planetId: planet.id, name: newName.trim() });
                  }}
                >
                  <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30} className="h-7 text-sm" />
                  <Button type="submit" size="sm" disabled={renameMutation.isPending}>OK</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setIsRenaming(false)}>Annuler</Button>
                </form>
              ) : (
                <h1
                  className={`text-lg lg:text-xl font-bold text-foreground truncate ${!planet.renamed ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                  onClick={!planet.renamed ? () => { setNewName(planet.name); setIsRenaming(true); } : undefined}
                  title={!planet.renamed ? 'Cliquer pour renommer' : undefined}
                >
                  {planet.name}
                  {flagshipOnPlanet && (
                    <FlagshipIcon width={16} height={16} className="inline-block ml-2 text-energy align-text-bottom" />
                  )}
                </h1>
              )}
              <p className="text-xs text-muted-foreground">
                [{planet.galaxy}:{planet.system}:{planet.position}]
                {' '} · {planet.diameter.toLocaleString('fr-FR')} km
                {' '} · {planet.minTemp}&deg;C a {planet.maxTemp}&deg;C
              </p>
            </div>
          </div>

          {/* Biomes */}
          {biomes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {biomes.map((biome) => (
                <span key={biome.id}>{renderBiomeBadge(biome)}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Planet detail overlay */}
      <EntityDetailOverlay open={showDetail} onClose={() => setShowDetail(false)} title={planet.name}>
        {renderPlanetDetail(planet)}
      </EntityDetailOverlay>
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to OverviewHero

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/overview/OverviewHero.tsx
git commit -m "feat(overview): add compact hero banner component"
```

---

### Task 2: OverviewKpiBar — KPI pills with expandable panels

**Files:**
- Create: `apps/web/src/components/overview/OverviewKpiBar.tsx`

- [ ] **Step 1: Create the OverviewKpiBar component**

This follows the same toggle pattern as `EmpireKpiBar.tsx`. Pills for minerai, silicium, hydrogene, energy, fleet. Each pill expands a detail panel below.

```tsx
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from '@/components/common/ResourceIcons';

type PanelId = 'minerai' | 'silicium' | 'hydrogene' | 'energy' | 'fleet' | null;

interface ResourceData {
  minerai: number;
  silicium: number;
  hydrogene: number;
  mineraiPerHour: number;
  siliciumPerHour: number;
  hydrogenePerHour: number;
  storageMineraiCapacity: number;
  storageSiliciumCapacity: number;
  storageHydrogeneCapacity: number;
  energyProduced: number;
  energyConsumed: number;
  protectedMinerai?: number;
  protectedSilicium?: number;
  protectedHydrogene?: number;
}

interface ShipCount {
  id: string;
  name: string;
  count: number;
}

interface OverviewKpiBarProps {
  resources: ResourceData | undefined;
  liveResources: { minerai: number; silicium: number; hydrogene: number } | undefined;
  ships: ShipCount[];
}

function formatRate(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.floor(value));
}

function Kpi({ iconNode, color, value, active, onClick }: {
  iconNode: React.ReactNode;
  color: string;
  value: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors shrink-0',
        active ? 'bg-accent/60 ring-1 ring-primary/30' : 'hover:bg-accent/30',
      )}
    >
      {iconNode}
      <span className={color}>{value}</span>
      <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', active && 'rotate-180')} />
    </button>
  );
}

function ResourceGauge({ current, capacity, rate, label, color, protectedAmount }: {
  current: number; capacity: number; rate: number; label: string; color: string; protectedAmount?: number;
}) {
  const pct = capacity > 0 ? Math.min(100, Math.round((current / capacity) * 100)) : 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="text-center">
      <div className="relative w-[66px] h-[66px] flex items-center justify-center mx-auto">
        <svg className="absolute top-0 left-0 -rotate-90" width={66} height={66}>
          <circle cx={33} cy={33} r={radius} fill="none" stroke={color} strokeWidth={3} opacity={0.2} />
          <circle cx={33} cy={33} r={radius} fill="none" stroke={color} strokeWidth={3}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
          {protectedAmount != null && protectedAmount > 0 && (() => {
            const protPct = Math.min(100, (protectedAmount / capacity) * 100);
            const protOffset = circumference - (protPct / 100) * circumference;
            return <circle cx={33} cy={33} r={radius} fill="none" stroke="#22c55e" strokeWidth={2}
              strokeDasharray={circumference} strokeDashoffset={protOffset} strokeLinecap="round" opacity={0.4} />;
          })()}
        </svg>
        <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="text-[10px] mt-1 font-medium" style={{ color }}>{label}</div>
      <div className="text-[10px] text-muted-foreground">+{Math.floor(rate).toLocaleString('fr-FR')}/h</div>
      {protectedAmount != null && protectedAmount > 0 && (
        <div className="text-[9px] text-green-500/70 flex items-center justify-center gap-0.5">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          {Math.floor(protectedAmount).toLocaleString('fr-FR')}
        </div>
      )}
    </div>
  );
}

export function OverviewKpiBar({ resources, liveResources, ships }: OverviewKpiBarProps) {
  const [openPanel, setOpenPanel] = useState<PanelId>(null);
  const toggle = (id: PanelId) => setOpenPanel((prev) => (prev === id ? null : id));

  const totalShips = ships.reduce((sum, s) => sum + s.count, 0);
  const energyBalance = (resources?.energyProduced ?? 0) - (resources?.energyConsumed ?? 0);
  const energyPositive = energyBalance >= 0;

  return (
    <div className="rounded-xl border border-border/30 bg-card/60 overflow-hidden">
      {/* KPI row */}
      <div className="flex items-center justify-between gap-1 px-2 py-2 lg:gap-3 lg:px-4 overflow-x-auto">
        <Kpi
          iconNode={<MineraiIcon size={14} className="text-minerai" />}
          color="text-minerai"
          value={`${formatRate(resources?.mineraiPerHour ?? 0)}/h`}
          active={openPanel === 'minerai'}
          onClick={() => toggle('minerai')}
        />
        <Kpi
          iconNode={<SiliciumIcon size={14} className="text-silicium" />}
          color="text-silicium"
          value={`${formatRate(resources?.siliciumPerHour ?? 0)}/h`}
          active={openPanel === 'silicium'}
          onClick={() => toggle('silicium')}
        />
        <Kpi
          iconNode={<HydrogeneIcon size={14} className="text-hydrogene" />}
          color="text-hydrogene"
          value={`${formatRate(resources?.hydrogenePerHour ?? 0)}/h`}
          active={openPanel === 'hydrogene'}
          onClick={() => toggle('hydrogene')}
        />
        <div className="hidden h-5 w-px bg-border/40 lg:block" />
        <Kpi
          iconNode={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={energyPositive ? 'text-yellow-400' : 'text-red-400'}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
          color={energyPositive ? 'text-yellow-400' : 'text-red-400'}
          value={`${energyPositive ? '+' : ''}${Math.floor(energyBalance)}`}
          active={openPanel === 'energy'}
          onClick={() => toggle('energy')}
        />
        <div className="hidden h-5 w-px bg-border/40 lg:block" />
        <Kpi
          iconNode={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400"><path d="M2 20h.01M7 20v-4M12 20V10M17 20V4M22 20h.01"/></svg>}
          color="text-cyan-400"
          value={`${totalShips} vsx`}
          active={openPanel === 'fleet'}
          onClick={() => toggle('fleet')}
        />
      </div>

      {/* Expandable panels */}
      {openPanel === 'minerai' && resources && (
        <div className="border-t border-border/30 px-4 py-3">
          <ResourceGauge
            current={liveResources?.minerai ?? 0}
            capacity={resources.storageMineraiCapacity}
            rate={resources.mineraiPerHour}
            label="Minerai"
            color="#fb923c"
            protectedAmount={resources.protectedMinerai}
          />
        </div>
      )}
      {openPanel === 'silicium' && resources && (
        <div className="border-t border-border/30 px-4 py-3">
          <ResourceGauge
            current={liveResources?.silicium ?? 0}
            capacity={resources.storageSiliciumCapacity}
            rate={resources.siliciumPerHour}
            label="Silicium"
            color="#34d399"
            protectedAmount={resources.protectedSilicium}
          />
        </div>
      )}
      {openPanel === 'hydrogene' && resources && (
        <div className="border-t border-border/30 px-4 py-3">
          <ResourceGauge
            current={liveResources?.hydrogene ?? 0}
            capacity={resources.storageHydrogeneCapacity}
            rate={resources.hydrogenePerHour}
            label="Hydrogene"
            color="#60a5fa"
            protectedAmount={resources.protectedHydrogene}
          />
        </div>
      )}
      {openPanel === 'energy' && resources && (
        <div className="border-t border-border/30 px-4 py-3">
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Produite</div>
              <div className="text-sm font-bold text-yellow-400">{Math.floor(resources.energyProduced).toLocaleString('fr-FR')}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Consommee</div>
              <div className="text-sm font-bold text-orange-400">{Math.floor(resources.energyConsumed).toLocaleString('fr-FR')}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance</div>
              <div className={`text-sm font-bold ${energyPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {energyPositive ? '+' : ''}{Math.floor(energyBalance).toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
          {/* Visual bar */}
          <div className="mt-2 h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400"
              style={{ width: `${Math.min(100, resources.energyProduced > 0 ? (resources.energyConsumed / resources.energyProduced) * 100 : 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
            <span>0</span>
            <span>{Math.floor(resources.energyProduced).toLocaleString('fr-FR')}</span>
          </div>
        </div>
      )}
      {openPanel === 'fleet' && (
        <div className="border-t border-border/30 px-4 py-3">
          {ships.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {ships.map((ship) => (
                <div key={ship.id} className="flex justify-between px-2 py-1.5 rounded bg-muted/30">
                  <span className="text-muted-foreground">{ship.name}</span>
                  <span className="text-foreground font-semibold">{ship.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Aucun vaisseau stationne</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to OverviewKpiBar

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/overview/OverviewKpiBar.tsx
git commit -m "feat(overview): add KPI bar with expandable resource/energy/fleet panels"
```

---

### Task 3: OverviewActivities — 3 activity slots

**Files:**
- Create: `apps/web/src/components/overview/OverviewActivities.tsx`

- [ ] **Step 1: Create the OverviewActivities component**

```tsx
import { useNavigate } from 'react-router';
import { GameImage } from '@/components/common/GameImage';
import { Timer } from '@/components/common/Timer';
import { getUnitName } from '@/lib/entity-names';

interface BuildingActivity {
  id: string;
  name: string;
  currentLevel: number;
  nextLevelTime: number;
  upgradeEndTime: string;
}

interface QueueItem {
  id: string;
  itemId: string;
  type: 'ship' | 'defense';
  quantity: number;
  completedCount?: number;
  startTime: string;
  endTime: string | null;
  status: string;
  facilityId: string | null;
}

interface OverviewActivitiesProps {
  activeBuilding: BuildingActivity | undefined;
  shipyardQueue: QueueItem[];
  commandCenterQueue: QueueItem[];
  planetId: string;
  gameConfig: any;
  onBuildingComplete: () => void;
  onShipyardComplete: () => void;
  onCommandCenterComplete: () => void;
}

function ActiveSlot({ icon, label, sublabel, endTime, startTime, totalDuration, color, onClick, onComplete }: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  endTime: string;
  startTime?: string;
  totalDuration: number;
  color: string;
  onClick: () => void;
  onComplete: () => void;
}) {
  return (
    <div
      className="flex-1 min-w-[140px] p-2.5 rounded-lg bg-card/60 border border-white/[0.06] cursor-pointer hover:bg-card/80 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-foreground truncate">{label}</div>
          <div className="text-[10px] text-muted-foreground">{sublabel}</div>
        </div>
      </div>
      <div className="h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-1000"
          style={{ background: color, width: `${Math.min(100, Math.max(0, ((Date.now() - new Date(startTime ?? endTime).getTime()) / (new Date(endTime).getTime() - new Date(startTime ?? endTime).getTime())) * 100))}%` }}
        />
      </div>
      <div className="mt-1">
        <Timer
          endTime={new Date(endTime)}
          totalDuration={totalDuration}
          className="text-[10px]"
          onComplete={onComplete}
        />
      </div>
    </div>
  );
}

function EmptySlot({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
  return (
    <div
      className="flex-1 min-w-[140px] p-2.5 rounded-lg bg-card/30 border border-dashed border-white/[0.08] cursor-pointer hover:bg-card/40 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-white/[0.04]" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-[10px] text-muted-foreground/50 mt-2">{cta} →</div>
    </div>
  );
}

export function OverviewActivities({
  activeBuilding, shipyardQueue, commandCenterQueue, planetId, gameConfig,
  onBuildingComplete, onShipyardComplete, onCommandCenterComplete,
}: OverviewActivitiesProps) {
  const navigate = useNavigate();

  const activeShipyard = shipyardQueue.find((q) => q.status === 'active' && q.endTime);
  const activeCommandCenter = commandCenterQueue.find((q) => q.status === 'active' && q.endTime);

  return (
    <div className="flex gap-3 overflow-x-auto">
      {/* Construction slot */}
      {activeBuilding ? (
        <ActiveSlot
          icon={<GameImage category="buildings" id={activeBuilding.id} size="icon" alt={activeBuilding.name} className="w-5 h-5 rounded flex-shrink-0" />}
          label={activeBuilding.name}
          sublabel={`Niv. ${activeBuilding.currentLevel + 1}`}
          endTime={activeBuilding.upgradeEndTime}
          totalDuration={activeBuilding.nextLevelTime}
          color="#38bdf8"
          onClick={() => navigate('/buildings')}
          onComplete={onBuildingComplete}
        />
      ) : (
        <EmptySlot label="Aucune construction" cta="Lancer" onClick={() => navigate('/buildings')} />
      )}

      {/* Shipyard slot */}
      {activeShipyard ? (
        <ActiveSlot
          icon={<GameImage category={activeShipyard.type === 'defense' ? 'defenses' : 'ships'} id={activeShipyard.itemId} size="icon" alt={getUnitName(activeShipyard.itemId, gameConfig)} className="w-5 h-5 rounded flex-shrink-0" />}
          label={getUnitName(activeShipyard.itemId, gameConfig)}
          sublabel={`x${activeShipyard.quantity - (activeShipyard.completedCount ?? 0)}`}
          endTime={activeShipyard.endTime!}
          startTime={activeShipyard.startTime}
          totalDuration={Math.floor((new Date(activeShipyard.endTime!).getTime() - new Date(activeShipyard.startTime).getTime()) / 1000)}
          color="#f59e0b"
          onClick={() => navigate('/shipyard')}
          onComplete={onShipyardComplete}
        />
      ) : (
        <EmptySlot label="Chantier libre" cta="Lancer une production" onClick={() => navigate('/shipyard')} />
      )}

      {/* Command center slot */}
      {activeCommandCenter ? (
        <ActiveSlot
          icon={<GameImage category={activeCommandCenter.type === 'defense' ? 'defenses' : 'ships'} id={activeCommandCenter.itemId} size="icon" alt={getUnitName(activeCommandCenter.itemId, gameConfig)} className="w-5 h-5 rounded flex-shrink-0" />}
          label={getUnitName(activeCommandCenter.itemId, gameConfig)}
          sublabel={`x${activeCommandCenter.quantity - (activeCommandCenter.completedCount ?? 0)}`}
          endTime={activeCommandCenter.endTime!}
          startTime={activeCommandCenter.startTime}
          totalDuration={Math.floor((new Date(activeCommandCenter.endTime!).getTime() - new Date(activeCommandCenter.startTime).getTime()) / 1000)}
          color="#8b5cf6"
          onClick={() => navigate('/command-center')}
          onComplete={onCommandCenterComplete}
        />
      ) : (
        <EmptySlot label="Commandement libre" cta="Lancer une production" onClick={() => navigate('/command-center')} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to OverviewActivities

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/overview/OverviewActivities.tsx
git commit -m "feat(overview): add 3-slot activity row (construction/shipyard/command-center)"
```

---

### Task 4: AttackAlert — Extract hostile fleet banner

**Files:**
- Create: `apps/web/src/components/overview/AttackAlert.tsx`

- [ ] **Step 1: Create the AttackAlert component**

Extract the hostile inbound fleet alert banner from the current `Overview.tsx` (lines 740-843). This is a direct extraction — same design with animated scan line, detection tiers, and timer.

```tsx
import { useNavigate } from 'react-router';
import { Timer } from '@/components/common/Timer';

interface InboundFleet {
  id: string;
  senderUsername: string | null;
  allianceTag: string | null;
  originGalaxy: number;
  originSystem: number;
  originPosition: number;
  departureTime: string;
  arrivalTime: string;
  ships: Record<string, number>;
  detectionTier?: number;
  shipCount?: number;
}

interface AttackAlertProps {
  hostileFleets: InboundFleet[];
  onTimerComplete: () => void;
}

export function AttackAlert({ hostileFleets, onTimerComplete }: AttackAlertProps) {
  const navigate = useNavigate();

  if (hostileFleets.length === 0) return null;

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-red-500/40 cursor-pointer hover:border-red-500/60 transition-colors"
      style={{ background: 'linear-gradient(135deg, rgba(127,29,29,0.5) 0%, rgba(69,10,10,0.6) 50%, rgba(127,29,29,0.4) 100%)' }}
      onClick={() => navigate('/fleet/movements')}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.08) 50%, transparent 100%)',
          animation: 'scan 3s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes scan { 0%,100% { transform: translateX(-100%); } 50% { transform: translateX(100%); } }`}</style>

      <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-red-600" />

      <div className="px-4 py-3 space-y-2.5 relative">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping opacity-40" />
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span className="text-red-400 font-bold text-sm uppercase tracking-wider">Attaque imminente</span>
          <span className="text-red-400/60 text-[10px] font-semibold ml-auto">
            {hostileFleets.length} flotte{hostileFleets.length > 1 ? 's' : ''}
          </span>
        </div>

        {hostileFleets.map((event) => {
          const tier = event.detectionTier ?? 0;
          const ships = event.ships;
          const shipCount = tier >= 3
            ? Object.values(ships).reduce((sum, n) => sum + n, 0)
            : tier >= 2 ? (event.shipCount ?? 0) : 0;
          const hasOrigin = tier >= 1;
          const hasSender = tier >= 4;

          const dep = new Date(event.departureTime).getTime();
          const arr = new Date(event.arrivalTime).getTime();
          const total = arr - dep;
          const progress = total > 0 ? Math.min(100, Math.max(0, ((Date.now() - dep) / total) * 100)) : 100;

          return (
            <div key={event.id} className="space-y-1.5 border-t border-red-500/20 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-red-300">
                  {hasSender ? (
                    <>
                      {event.allianceTag && <span className="text-red-400 mr-1">[{event.allianceTag}]</span>}
                      {event.senderUsername}
                    </>
                  ) : (
                    <span className="italic text-red-400/50">Attaquant inconnu</span>
                  )}
                </span>
                <div className="ml-auto">
                  <Timer endTime={new Date(event.arrivalTime)} onComplete={onTimerComplete} className="!text-red-400 font-bold" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-red-300/60">
                <span>{hasOrigin ? `[${event.originGalaxy}:${event.originSystem}:${event.originPosition}]` : '???'} → ici</span>
                {shipCount > 0 && (
                  <>
                    <span className="text-red-500/30">·</span>
                    <span>{shipCount} vaisseaux</span>
                  </>
                )}
              </div>
              <div className="h-1 rounded-full bg-red-950/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400" style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to AttackAlert

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/overview/AttackAlert.tsx
git commit -m "feat(overview): extract attack alert banner component"
```

---

### Task 5: OverviewGrid — 2x2 grid (fleet, movements, defenses, flagship)

**Files:**
- Create: `apps/web/src/components/overview/OverviewGrid.tsx`

- [ ] **Step 1: Create the OverviewGrid component**

```tsx
import { useNavigate } from 'react-router';
import { Timer } from '@/components/common/Timer';
import { FleetIcon, DefenseIcon, FlagshipIcon, MovementsIcon } from '@/lib/icons';
import { getFlagshipImageUrl } from '@/lib/assets';

interface ShipCount {
  id: string;
  name: string;
  count: number;
}

interface DefenseCount {
  id: string;
  name: string;
  count: number;
}

interface FleetMovement {
  id: string;
  mission: string;
  phase: string;
  departureTime: string;
  arrivalTime: string;
  ships: Record<string, number>;
  targetGalaxy: number;
  targetSystem: number;
  targetPosition: number;
  originPlanetId: string;
  mineraiCargo: number;
  siliciumCargo: number;
  hydrogeneCargo: number;
  // For inbound peaceful
  senderUsername?: string | null;
  allianceTag?: string | null;
  originGalaxy?: number;
  originSystem?: number;
  originPosition?: number;
  originPlanetName?: string | null;
}

interface FlagshipData {
  name: string;
  status: string;
  hullId: string | null;
  flagshipImageIndex: number | null;
  planetId: string | null;
}

interface OverviewGridProps {
  ships: ShipCount[];
  defenses: DefenseCount[];
  movements: FleetMovement[];
  flagship: FlagshipData | undefined;
  currentPlanetId: string;
  currentPlanetName: string;
  currentPlanetCoords: { galaxy: number; system: number; position: number };
  gameConfig: any;
  onFleetTimerComplete: () => void;
}

function GridCard({ children, onClick, className = '' }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <div
      className={`glass-card p-3 cursor-pointer hover:bg-muted/30 transition-colors ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

function GridHeader({ icon: Icon, label, color, count }: { icon: any; label: string; color: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className={`text-[11px] font-semibold flex items-center gap-1.5 ${color}`}>
        <Icon width={14} height={14} />
        {label}
      </h3>
      {count != null && <span className="text-[10px] text-muted-foreground">{count}</span>}
    </div>
  );
}

export function OverviewGrid({
  ships, defenses, movements, flagship, currentPlanetId, currentPlanetName, currentPlanetCoords, gameConfig, onFleetTimerComplete,
}: OverviewGridProps) {
  const navigate = useNavigate();
  const totalShips = ships.reduce((sum, s) => sum + s.count, 0);
  const totalDefenses = defenses.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Fleet */}
      <GridCard onClick={() => navigate('/fleet')}>
        <GridHeader icon={FleetIcon} label="Flotte stationnee" color="text-cyan-400" count={totalShips} />
        {ships.length > 0 ? (
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {ships.map((s) => (
              <div key={s.id} className="flex justify-between px-1.5 py-1 rounded bg-white/[0.03]">
                <span className="text-muted-foreground truncate">{s.name}</span>
                <span className="font-semibold ml-1">{s.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">Aucun vaisseau stationne</p>
        )}
      </GridCard>

      {/* Movements */}
      <GridCard onClick={() => navigate('/fleet/movements')}>
        <GridHeader icon={MovementsIcon} label="Mouvements" color="text-purple-400" count={movements.length} />
        {movements.length > 0 ? (
          <div className="space-y-1.5">
            {movements.slice(0, 4).map((m) => {
              const missionLabel = gameConfig?.missions[m.mission]?.label ?? m.mission;
              const hex = gameConfig?.missions[m.mission]?.color ?? '#8b5cf6';
              const phaseLabel = gameConfig?.labels[`phase.${m.phase}`] ?? m.phase;

              return (
                <div key={m.id} className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: hex }} />
                    <span className="font-medium text-foreground truncate">{missionLabel}</span>
                    <span className="text-muted-foreground/60 text-[9px]">{phaseLabel}</span>
                    <div className="ml-auto flex-shrink-0">
                      <Timer endTime={new Date(m.arrivalTime)} onComplete={onFleetTimerComplete} className="!text-[9px]" />
                    </div>
                  </div>
                  <div className="h-[1.5px] rounded-full bg-white/[0.04] overflow-hidden ml-3">
                    <div className="h-full rounded-full" style={{
                      background: hex,
                      width: `${Math.min(100, Math.max(0, ((Date.now() - new Date(m.departureTime).getTime()) / (new Date(m.arrivalTime).getTime() - new Date(m.departureTime).getTime())) * 100))}%`,
                    }} />
                  </div>
                </div>
              );
            })}
            {movements.length > 4 && (
              <p className="text-[9px] text-muted-foreground">+{movements.length - 4} autre{movements.length - 4 > 1 ? 's' : ''}</p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">Aucun mouvement</p>
        )}
      </GridCard>

      {/* Defenses — col-span-2 on mobile, normal on desktop */}
      <GridCard onClick={() => navigate('/defense')} className="col-span-2 lg:col-span-1">
        <GridHeader icon={DefenseIcon} label="Defenses" color="text-emerald-400" count={totalDefenses} />
        {defenses.length > 0 ? (
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {defenses.map((d) => (
              <div key={d.id} className="flex justify-between px-1.5 py-1 rounded bg-white/[0.03]">
                <span className="text-muted-foreground truncate">{d.name}</span>
                <span className="font-semibold ml-1">{d.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">Aucune defense</p>
        )}
      </GridCard>

      {/* Flagship — col-span-2 on mobile, normal on desktop */}
      <GridCard onClick={() => navigate('/flagship')} className="col-span-2 lg:col-span-1">
        <GridHeader icon={FlagshipIcon} label="Vaisseau amiral" color="text-yellow-400" />
        {flagship ? (
          flagship.planetId === currentPlanetId ? (
            <div className="flex items-center gap-3">
              {flagship.flagshipImageIndex ? (
                <img
                  src={getFlagshipImageUrl(flagship.hullId ?? 'industrial', flagship.flagshipImageIndex, 'icon')}
                  alt={flagship.name}
                  className="w-7 h-7 rounded-md object-cover border border-white/10 flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-md bg-primary/10 border border-white/10 flex items-center justify-center text-[9px] font-bold text-primary/30 flex-shrink-0">VA</div>
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-medium truncate">{flagship.name}</div>
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    flagship.status === 'active' ? 'bg-emerald-400' :
                    flagship.status === 'in_mission' ? 'bg-blue-400' : 'bg-red-400'
                  }`} />
                  <span className={
                    flagship.status === 'active' ? 'text-emerald-400' :
                    flagship.status === 'in_mission' ? 'text-blue-400' : 'text-red-400'
                  }>
                    {flagship.status === 'active' ? 'Operationnel' :
                     flagship.status === 'in_mission' ? 'En mission' : 'Incapacite'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">Pas sur cette planete</p>
          )
        ) : (
          <p className="text-[10px] text-muted-foreground italic">Aucun vaisseau amiral</p>
        )}
      </GridCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to OverviewGrid

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/overview/OverviewGrid.tsx
git commit -m "feat(overview): add 2x2 grid component (fleet/movements/defenses/flagship)"
```

---

### Task 6: OverviewEvents — Collapsible recent events

**Files:**
- Create: `apps/web/src/components/overview/OverviewEvents.tsx`

- [ ] **Step 1: Create the OverviewEvents component**

```tsx
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { eventTypeColor, formatEventText, formatRelativeTime, groupEvents } from '@/lib/game-events';

interface GameEvent {
  id: string;
  type: string;
  createdAt: string;
  [key: string]: any;
}

interface OverviewEventsProps {
  events: GameEvent[];
  gameConfig: any;
}

export function OverviewEvents({ events, gameConfig }: OverviewEventsProps) {
  const [open, setOpen] = useState(false);

  if (events.length === 0) return null;

  const grouped = groupEvents(events);

  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          {grouped.length} evenement{grouped.length > 1 ? 's' : ''} recent{grouped.length > 1 ? 's' : ''}
        </span>
        <span className="text-muted-foreground/50">
          {open ? 'Masquer' : 'Voir'}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/30 px-4 py-2">
          <div className="space-y-0.5">
            {grouped.map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${eventTypeColor(event.type)}`} />
                  <span className="text-muted-foreground">{formatEventText(event, { missions: gameConfig?.missions })}</span>
                </div>
                <span className="text-xs text-muted-foreground/60 shrink-0 ml-2">{formatRelativeTime(event.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to OverviewEvents

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/overview/OverviewEvents.tsx
git commit -m "feat(overview): add collapsible recent events component"
```

---

### Task 7: Rewrite Overview.tsx — Slim orchestrator

**Files:**
- Rewrite: `apps/web/src/pages/Overview.tsx`

This is the main integration task. The new Overview.tsx is a slim orchestrator that:
1. Runs all queries (same as today)
2. Handles guards (loading, colonization redirect, error, empty)
3. Renders the 6 child components in order
4. Keeps BiomeBadge and PlanetDetailContent inline (they use portal/gameConfig and are tightly coupled to this page)

- [ ] **Step 1: Rewrite Overview.tsx**

The new file keeps `BiomeBadge` and `PlanetDetailContent` (they're used only here and rely on portal + refs). Everything else delegates to the new components.

```tsx
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { useGameConfig } from '@/hooks/useGameConfig';
import { OverviewSkeleton } from '@/components/common/PageSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { QueryError } from '@/components/common/QueryError';
import { getPlanetImageUrl } from '@/lib/assets';
import ColonizationProgress from './ColonizationProgress';

import { OverviewHero } from '@/components/overview/OverviewHero';
import { OverviewKpiBar } from '@/components/overview/OverviewKpiBar';
import { OverviewActivities } from '@/components/overview/OverviewActivities';
import { AttackAlert } from '@/components/overview/AttackAlert';
import { OverviewGrid } from '@/components/overview/OverviewGrid';
import { OverviewEvents } from '@/components/overview/OverviewEvents';

// ── Rarity / biome constants (used by BiomeBadge) ──

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Commun',
  uncommon: 'Peu commun',
  rare: 'Rare',
  epic: 'Epique',
  legendary: 'Legendaire',
};

const STAT_LABELS: Record<string, string> = {
  production_minerai: 'Production minerai',
  production_silicium: 'Production silicium',
  production_hydrogene: 'Production hydrogene',
  energy_production: 'Production energie',
  storage_minerai: 'Stockage minerai',
  storage_silicium: 'Stockage silicium',
  storage_hydrogene: 'Stockage hydrogene',
};

function BiomeBadge({ biome, size = 'sm' }: { biome: any; size?: 'sm' | 'xs' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const color = RARITY_COLORS[biome.rarity] ?? '#9ca3af';
  const textSize = size === 'xs' ? 'text-[10px]' : 'text-[11px]';
  const dotSize = 'w-1.5 h-1.5';
  const padding = size === 'xs' ? 'px-1.5 py-px' : 'px-2 py-0.5';

  const handleEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 224;
      const viewportWidth = window.innerWidth;
      let left = rect.left;
      if (left + popoverWidth > viewportWidth - 8) {
        left = Math.max(8, viewportWidth - popoverWidth - 8);
      }
      setCoords({ top: rect.bottom + 6, left });
    }
    setIsOpen(true);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={() => { setIsOpen(false); setCoords(null); }}
        className={`inline-flex items-center gap-1 rounded-full ${padding} ${textSize} font-medium border cursor-default transition-colors`}
        style={{
          color,
          borderColor: `${color}${isOpen ? '55' : '33'}`,
          backgroundColor: `${color}${isOpen ? '25' : '15'}`,
        }}
      >
        <span className={`${dotSize} rounded-full`} style={{ backgroundColor: color }} />
        {biome.name}
      </span>
      {isOpen && coords && createPortal(
        <div
          className="fixed w-56 rounded-lg border border-border bg-popover p-3 shadow-xl pointer-events-none"
          style={{ top: coords.top, left: coords.left, zIndex: 9999 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm font-semibold" style={{ color }}>{biome.name}</span>
          </div>
          <span
            className="inline-block rounded-full px-1.5 py-px text-[10px] font-medium mb-2"
            style={{ color, backgroundColor: `${color}20` }}
          >
            {RARITY_LABELS[biome.rarity] ?? biome.rarity}
          </span>
          {biome.description && (
            <p className="text-xs text-muted-foreground mb-2 italic">{biome.description}</p>
          )}
          {biome.effects && biome.effects.length > 0 && (
            <div className="space-y-1">
              {biome.effects.map((e: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{STAT_LABELS[e.stat] ?? e.stat}</span>
                  <span className={e.modifier > 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                    {e.modifier > 0 ? '+' : ''}{Math.round(e.modifier * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

function PlanetDetailContent({ planet, resourceData, gameConfig }: { planet: any; resourceData: any; gameConfig: any }) {
  const biomes = (planet.biomes ?? []) as Array<{ id: string; name: string; rarity: string; effects?: Array<{ stat: string; modifier: number }> }>;
  const aggregatedBonuses: Record<string, number> = {};
  for (const biome of biomes) {
    const configBiome = gameConfig?.biomes?.find((b: any) => b.id === biome.id);
    const effects = (configBiome?.effects ?? biome.effects ?? []) as Array<{ stat: string; modifier: number }>;
    for (const e of effects) {
      if (typeof e.modifier === 'number') aggregatedBonuses[e.stat] = (aggregatedBonuses[e.stat] ?? 0) + e.modifier;
    }
  }
  const planetTypeName = gameConfig?.planetTypes?.find((t: any) => t.id === planet.planetClassId)?.name ?? planet.planetClassId;

  return (
    <>
      <div className="relative -mx-5 -mt-5 h-[200px] overflow-hidden">
        {planet.planetClassId && planet.planetImageIndex != null ? (
          <img src={getPlanetImageUrl(planet.planetClassId, planet.planetImageIndex)} alt={planet.name} className="w-full h-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-indigo-950 via-purple-900/60 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{planet.name}</h3>
            <p className="text-xs text-white/70">[{planet.galaxy}:{planet.system}:{planet.position}]</p>
          </div>
          <span className="text-xs font-medium text-white/80 bg-white/10 rounded-full px-2.5 py-0.5 backdrop-blur-sm">{planetTypeName}</span>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-2">Caracteristiques</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/30 bg-card/50 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">Diametre</div>
            <div className="text-sm font-bold text-foreground">{planet.diameter.toLocaleString('fr-FR')} km</div>
          </div>
          <div className="rounded-lg border border-border/30 bg-card/50 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">Temperature</div>
            <div className="text-sm font-bold text-foreground">{planet.minTemp}&deg;C a {planet.maxTemp}&deg;C</div>
          </div>
          <div className="rounded-lg border border-border/30 bg-card/50 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">Type</div>
            <div className="text-sm font-bold text-foreground">{planetTypeName}</div>
          </div>
          <div className="rounded-lg border border-border/30 bg-card/50 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">Energie</div>
            <div className="text-sm font-bold" style={{ color: (resourceData?.rates.energyProduced ?? 0) >= (resourceData?.rates.energyConsumed ?? 0) ? '#facc15' : '#f87171' }}>
              {Math.floor(resourceData?.rates.energyProduced ?? 0) - Math.floor(resourceData?.rates.energyConsumed ?? 0)} / {Math.floor(resourceData?.rates.energyProduced ?? 0)}
            </div>
          </div>
        </div>
      </div>
      {biomes.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-2">Biomes</div>
          <div className="space-y-2">
            {biomes.map((biome) => {
              const bColor = RARITY_COLORS[biome.rarity] ?? '#9ca3af';
              const configBiome = gameConfig?.biomes?.find((b: any) => b.id === biome.id);
              const effects = (configBiome?.effects ?? biome.effects ?? []) as Array<{ stat: string; modifier: number }>;
              return (
                <div key={biome.id} className="rounded-md px-3 py-2" style={{ backgroundColor: `${bColor}10`, borderLeft: `3px solid ${bColor}` }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bColor }} />
                    <span className="text-xs font-semibold" style={{ color: bColor }}>{biome.name}</span>
                    <span className="text-[9px] rounded-full px-1.5 py-px" style={{ color: bColor, backgroundColor: `${bColor}20` }}>
                      {RARITY_LABELS[biome.rarity] ?? biome.rarity}
                    </span>
                  </div>
                  {effects.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 mt-1 ml-4">
                      {effects.map((e, i) => (
                        <span key={i} className={`text-[10px] ${e.modifier > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {e.modifier > 0 ? '+' : ''}{Math.round(e.modifier * 100)}% {STAT_LABELS[e.stat] ?? e.stat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {Object.keys(aggregatedBonuses).length > 0 && (
            <div className="mt-3 rounded-md border border-border/30 bg-card/50 px-3 py-2">
              <div className="text-[10px] text-muted-foreground font-semibold mb-1">Bonus cumules</div>
              <div className="flex flex-wrap gap-x-4">
                {Object.entries(aggregatedBonuses).map(([stat, mod]) => (
                  <span key={stat} className={`text-xs ${mod > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {mod > 0 ? '+' : ''}{Math.round(mod * 100)}% {STAT_LABELS[stat] ?? stat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function Overview() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const utils = trpc.useUtils();

  const { data: gameConfig } = useGameConfig();
  const { data: planets, isLoading, isError, refetch } = trpc.planet.list.useQuery();

  const { data: resourceData } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const liveResources = useResourceCounter(
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

  const { data: buildings } = trpc.building.list.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: shipyardQueue } = trpc.shipyard.queue.useQuery(
    { planetId: planetId!, facilityId: 'shipyard' },
    { enabled: !!planetId },
  );

  const { data: commandCenterQueue } = trpc.shipyard.queue.useQuery(
    { planetId: planetId!, facilityId: 'commandCenter' },
    { enabled: !!planetId },
  );

  const { data: ships } = trpc.shipyard.ships.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: defenses } = trpc.shipyard.defenses.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: allMovements } = trpc.fleet.movements.useQuery();
  const { data: inboundFleets } = trpc.fleet.inbound.useQuery();
  const { data: recentEvents } = trpc.gameEvent.byPlanet.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: flagship } = trpc.flagship.get.useQuery();

  const { data: colonizationStatus } = trpc.colonization.status.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  // Guards — all hooks above, no conditional returns before this point
  if (isLoading || !planets) return <OverviewSkeleton />;
  if (colonizationStatus) return <ColonizationProgress />;
  if (isError) return (
    <div className="p-4 space-y-4">
      <QueryError error={{ message: 'Impossible de charger vos planetes.' }} retry={() => void refetch()} />
    </div>
  );

  const planet = planets?.find((p) => p.id === planetId) ?? planets?.[0];
  if (!planet) return <div className="p-4"><EmptyState title="Aucune planete trouvee" description="Aucune planete n'est associee a votre compte." /></div>;

  // Derive data for child components
  const activeBuilding = buildings?.find((b) => b.isUpgrading && b.upgradeEndTime);
  const stationaryShips = (ships?.filter((s) => s.count > 0) ?? []) as Array<{ id: string; name: string; count: number }>;
  const stationaryDefenses = (defenses?.filter((d) => d.count > 0) ?? []) as Array<{ id: string; name: string; count: number }>;

  // Movements from/to this planet
  const outboundMovements = allMovements?.filter((m) => m.originPlanetId === planet.id) ?? [];
  const ownInbound = allMovements?.filter(
    (m) => m.phase === 'outbound' && m.originPlanetId !== planet.id &&
      m.targetGalaxy === planet.galaxy && m.targetSystem === planet.system && m.targetPosition === planet.position,
  ) ?? [];
  const planetInbound = inboundFleets?.filter(
    (f) => f.targetGalaxy === planet.galaxy && f.targetSystem === planet.system && f.targetPosition === planet.position,
  ) ?? [];
  const hostileInbound = planetInbound.filter((e) => (e as any).hostile);
  const peacefulInbound = planetInbound.filter((e) => !(e as any).hostile);

  const allMovementsForGrid = [...outboundMovements, ...ownInbound, ...peacefulInbound] as any[];

  return (
    <div className="space-y-3 p-4 lg:p-6">
      {/* 1. Hero */}
      <OverviewHero
        planet={planet as any}
        flagshipOnPlanet={flagship?.planetId === planet.id}
        renderBiomeBadge={(biome) => <BiomeBadge biome={biome} size="xs" />}
        renderPlanetDetail={(p) => <PlanetDetailContent planet={p} resourceData={resourceData} gameConfig={gameConfig} />}
      />

      {/* 2. KPI Bar */}
      <OverviewKpiBar
        resources={resourceData ? {
          minerai: resourceData.minerai,
          silicium: resourceData.silicium,
          hydrogene: resourceData.hydrogene,
          mineraiPerHour: resourceData.rates.mineraiPerHour,
          siliciumPerHour: resourceData.rates.siliciumPerHour,
          hydrogenePerHour: resourceData.rates.hydrogenePerHour,
          storageMineraiCapacity: resourceData.rates.storageMineraiCapacity,
          storageSiliciumCapacity: resourceData.rates.storageSiliciumCapacity,
          storageHydrogeneCapacity: resourceData.rates.storageHydrogeneCapacity,
          energyProduced: resourceData.rates.energyProduced,
          energyConsumed: resourceData.rates.energyConsumed,
          protectedMinerai: resourceData.protectedMinerai,
          protectedSilicium: resourceData.protectedSilicium,
          protectedHydrogene: resourceData.protectedHydrogene,
        } : undefined}
        liveResources={liveResources}
        ships={stationaryShips}
      />

      {/* 3. Activities */}
      <OverviewActivities
        activeBuilding={activeBuilding as any}
        shipyardQueue={(shipyardQueue ?? []) as any[]}
        commandCenterQueue={(commandCenterQueue ?? []) as any[]}
        planetId={planetId!}
        gameConfig={gameConfig}
        onBuildingComplete={() => {
          utils.building.list.invalidate({ planetId: planetId! });
          utils.resource.production.invalidate({ planetId: planetId! });
        }}
        onShipyardComplete={() => {
          utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'shipyard' });
          utils.shipyard.ships.invalidate({ planetId: planetId! });
        }}
        onCommandCenterComplete={() => {
          utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'commandCenter' });
          utils.shipyard.ships.invalidate({ planetId: planetId! });
        }}
      />

      {/* 4. Attack alert */}
      <AttackAlert hostileFleets={hostileInbound as any[]} onTimerComplete={() => utils.fleet.inbound.invalidate()} />

      {/* 5. Grid */}
      <OverviewGrid
        ships={stationaryShips}
        defenses={stationaryDefenses}
        movements={allMovementsForGrid}
        flagship={flagship as any}
        currentPlanetId={planet.id}
        currentPlanetName={planet.name}
        currentPlanetCoords={{ galaxy: planet.galaxy, system: planet.system, position: planet.position }}
        gameConfig={gameConfig}
        onFleetTimerComplete={() => utils.fleet.movements.invalidate()}
      />

      {/* 6. Events */}
      <OverviewEvents events={(recentEvents ?? []) as any[]} gameConfig={gameConfig} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Visual test in browser**

Run: `cd apps/web && npm run dev`
Navigate to `/` and verify:
- Hero banner renders with planet image, name, coords, biomes
- KPI bar shows resource rates, energy balance, fleet count
- Clicking KPI pills opens/closes detail panels
- Activity slots show current builds or empty states
- Grid shows fleet, movements, defenses, flagship
- Events section is collapsed, expandable on click
- Mobile layout works (grid adapts)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Overview.tsx
git commit -m "feat(overview): rewrite page as dashboard with decomposed components"
```
