# Energy Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Resources page with a visual Energy page featuring a flow diagram, circular knob controls, planet identity card, and dual view (flux/table).

**Architecture:** Single-page refactor. The existing `Resources.tsx` is replaced by `Energy.tsx` which composes new sub-components: `PlanetCard`, `Knob`, `FluxView`, `TableView`, `EnergyBalance`, `ResourceImpact`. Backend changes are minimal — remove the 10% step constraint on percentages and enrich the production query with planet name/class data.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, tRPC, SVG for knob arcs and flow diagram, pointer events for drag interaction.

**Spec:** `docs/superpowers/specs/2026-03-31-energy-page-redesign.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/api/src/modules/resource/resource.router.ts` | Remove % 10 validation, add planet name/class to production query |
| Modify | `apps/web/tailwind.config.js` | Add `shield` color token |
| Create | `apps/web/src/components/energy/Knob.tsx` | Reusable circular knob control (drag, touch, tap-to-edit) |
| Create | `apps/web/src/components/energy/PlanetCard.tsx` | Planet identity card header |
| Create | `apps/web/src/components/energy/EnergyBalance.tsx` | Energy balance bar section |
| Create | `apps/web/src/components/energy/ResourceImpact.tsx` | Resource impact cards |
| Create | `apps/web/src/components/energy/FluxView.tsx` | Flow diagram view (sources, hub, SVG branches, consumer cards) |
| Create | `apps/web/src/components/energy/TableView.tsx` | Table view with mini knobs |
| Create | `apps/web/src/pages/Energy.tsx` | Main energy page, assembles all components |
| Modify | `apps/web/src/router.tsx` | Replace `/resources` route with `/energy` + redirect |
| Modify | `apps/web/src/components/layout/Sidebar.tsx` | Update nav label and path |
| Modify | `apps/web/src/components/layout/BottomTabBar.tsx` | Update mobile nav if it references resources |
| Delete | `apps/web/src/pages/Resources.tsx` | Old page |

---

### Task 1: Backend — Remove percentage step validation and enrich production query

**Files:**
- Modify: `apps/api/src/modules/resource/resource.router.ts:12-14` (percentSchema)
- Modify: `apps/api/src/modules/resource/resource.router.ts:48-63` (production query return)
- Modify: `apps/api/src/modules/resource/resource.router.ts:86` (shield percent validation)
- Modify: `packages/db/src/schema/planets.ts:28-32` (update comment)

- [ ] **Step 1: Update percentSchema to remove step-of-10 constraint**

In `apps/api/src/modules/resource/resource.router.ts`, replace line 12-14:

```typescript
// Before:
const percentSchema = z.number().int().min(0).max(100).refine((v) => v % 10 === 0, {
  message: 'Le pourcentage doit etre un multiple de 10',
});

// After:
const percentSchema = z.number().int().min(0).max(100);
```

- [ ] **Step 2: Update shield percent validation**

In the same file, line 86, replace:

```typescript
// Before:
percent: z.number().int().min(0).max(100).multipleOf(10),

// After:
percent: z.number().int().min(0).max(100),
```

- [ ] **Step 3: Enrich production query return with planet name and class info**

In the production query (line 28-63), the bonus query already fetches from `planetTypes`. Extend it to also return the type name, and add `planet.name` to the response.

Replace the bonus fetch block (lines 28-36):

```typescript
let bonus: { mineraiBonus: number; siliciumBonus: number; hydrogeneBonus: number } | undefined;
let planetTypeName: string | undefined;
if (planet.planetClassId) {
  const [pt] = await db.select({
    mineraiBonus: planetTypes.mineraiBonus,
    siliciumBonus: planetTypes.siliciumBonus,
    hydrogeneBonus: planetTypes.hydrogeneBonus,
    name: planetTypes.name,
  }).from(planetTypes).where(eq(planetTypes.id, planet.planetClassId)).limit(1);
  bonus = pt ?? undefined;
  planetTypeName = pt?.name;
}
```

Add to the return object (after line 55):

```typescript
return {
  rates,
  resourcesUpdatedAt: planet.resourcesUpdatedAt.toISOString(),
  minerai: Number(planet.minerai),
  silicium: Number(planet.silicium),
  hydrogene: Number(planet.hydrogene),
  maxTemp: planet.maxTemp,
  planetClassId: planet.planetClassId,
  planetName: planet.name,
  planetTypeName,
  planetTypeBonus: bonus,
  levels: {
    mineraiMine: buildingLevels[mineraiMineId] ?? 0,
    siliciumMine: buildingLevels[siliciumMineId] ?? 0,
    hydrogeneSynth: buildingLevels[hydrogeneSynthId] ?? 0,
    solarPlant: buildingLevels[solarPlantId] ?? 0,
    solarSatelliteCount: ships?.solarSatellite ?? 0,
  },
};
```

- [ ] **Step 4: Update schema comment**

In `packages/db/src/schema/planets.ts`, update line 28:

```typescript
// Before:
// Production percentages (0-100, step 10)

// After:
// Production percentages (0-100)
```

- [ ] **Step 5: Verify the API compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/resource/resource.router.ts packages/db/src/schema/planets.ts
git commit -m "feat(energy): remove 10% step constraint, add planet info to production query"
```

---

### Task 2: Add shield color to Tailwind config

**Files:**
- Modify: `apps/web/tailwind.config.js:41-44`

- [ ] **Step 1: Add shield color token**

In `apps/web/tailwind.config.js`, after the `energy` color line (line 44), add `shield`:

```javascript
minerai: '#fb923c',
silicium: '#34d399',
hydrogene: '#60a5fa',
energy: '#f0c040',
shield: '#22d3ee',
```

- [ ] **Step 2: Add flow animation keyframe**

In the `keyframes` section of the same file, add after `slide-down-sheet`:

```javascript
'flow-pulse': {
  '0%, 100%': { opacity: '0.3' },
  '50%': { opacity: '0.8' },
},
```

And in `animation`:

```javascript
'flow-pulse': 'flow-pulse 2s ease-in-out infinite',
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.js
git commit -m "feat(energy): add shield color and flow-pulse animation"
```

---

### Task 3: Create Knob component

**Files:**
- Create: `apps/web/src/components/energy/Knob.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useRef, useCallback, useEffect } from 'react';

interface KnobProps {
  value: number; // 0-100
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  color: string; // Tailwind color value e.g. '#fb923c'
  size?: 'sm' | 'md'; // sm=44px (table), md=72px (flux)
  disabled?: boolean;
}

const SIZES = { sm: 44, md: 72 } as const;
const STROKE = { sm: 2.5, md: 3 } as const;

export function Knob({ value, onChange, onChangeEnd, color, size = 'md', disabled = false }: KnobProps) {
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const dragStartRef = useRef<{ y: number; startValue: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const px = SIZES[size];
  const stroke = STROKE[size];
  const radius = (px - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);

  const fontSize = size === 'sm' ? 11 : 16;
  const unitSize = size === 'sm' ? 8 : 10;

  // Drag handler
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || editing) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragStartRef.current = { y: e.clientY, startValue: value };
      setDragging(true);
    },
    [disabled, editing, value],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current || disabled) return;
      const deltaY = dragStartRef.current.y - e.clientY;
      // 150px of drag = 100% change
      const deltaPercent = (deltaY / 150) * 100;
      const newValue = Math.round(Math.min(100, Math.max(0, dragStartRef.current.startValue + deltaPercent)));
      onChange(newValue);
    },
    [disabled, onChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      const deltaY = dragStartRef.current.y - e.clientY;
      const deltaPercent = (deltaY / 150) * 100;
      const newValue = Math.round(Math.min(100, Math.max(0, dragStartRef.current.startValue + deltaPercent)));
      dragStartRef.current = null;
      setDragging(false);
      onChangeEnd?.(newValue);
    },
    [onChangeEnd],
  );

  // Tap to edit (only if no drag movement)
  const handleClick = useCallback(() => {
    if (disabled || dragging) return;
    setEditing(true);
    setInputValue(String(value));
  }, [disabled, dragging, value]);

  // Input submit
  const commitEdit = useCallback(() => {
    setEditing(false);
    const parsed = Math.round(Math.min(100, Math.max(0, Number(inputValue) || 0)));
    onChange(parsed);
    onChangeEnd?.(parsed);
  }, [inputValue, onChange, onChangeEnd]);

  // Sync input when value changes externally
  useEffect(() => {
    if (!editing) setInputValue(String(value));
  }, [value, editing]);

  return (
    <div
      ref={containerRef}
      className="relative select-none"
      style={{ width: px, height: px, touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      {/* Background circle */}
      <svg width={px} height={px} className="absolute inset-0">
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="rgba(0,0,0,0.3)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* Value arc */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
          className="transition-[stroke-dashoffset] duration-100"
          opacity={disabled ? 0.3 : 0.8}
        />
      </svg>

      {/* Center value */}
      <div className="absolute inset-0 flex items-center justify-center">
        {editing ? (
          <input
            type="number"
            min={0}
            max={100}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
            className="w-[80%] bg-transparent text-center font-mono text-foreground outline-none"
            style={{ fontSize }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="font-mono font-bold text-foreground"
            style={{ fontSize, cursor: disabled ? 'default' : 'pointer' }}
          >
            {value}
            <span className="text-muted-foreground" style={{ fontSize: unitSize }}>%</span>
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/energy/Knob.tsx
git commit -m "feat(energy): create reusable Knob circular control component"
```

---

### Task 4: Create PlanetCard component

**Files:**
- Create: `apps/web/src/components/energy/PlanetCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface PlanetCardProps {
  name: string;
  planetTypeName?: string;
  maxTemp: number;
  bonus?: {
    mineraiBonus: number;
    siliciumBonus: number;
    hydrogeneBonus: number;
  };
}

function bonusTag(label: string, value: number) {
  if (!value || value === 1) return null;
  const percent = Math.round((value - 1) * 100);
  const positive = percent > 0;
  return (
    <span
      key={label}
      className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
        positive
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-destructive/10 text-destructive border-destructive/20'
      }`}
    >
      {positive ? '+' : ''}{percent}% {label}
    </span>
  );
}

export function PlanetCard({ name, planetTypeName, maxTemp, bonus }: PlanetCardProps) {
  return (
    <div className="glass-card flex items-center gap-4 p-4">
      {/* Planet icon */}
      <div
        className="size-14 shrink-0 rounded-full shadow-lg shadow-primary/20"
        style={{
          background: 'radial-gradient(circle at 35% 35%, hsl(var(--primary) / 0.6), hsl(var(--primary) / 0.2), hsl(var(--background)))',
        }}
      />

      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-foreground tracking-wide truncate">{name}</h2>
        <p className="text-xs text-muted-foreground">
          {planetTypeName ?? 'Inconnue'} · {maxTemp}°C
        </p>
        {bonus && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {bonusTag('minerai', bonus.mineraiBonus)}
            {bonusTag('silicium', bonus.siliciumBonus)}
            {bonusTag('hydrogène', bonus.hydrogeneBonus)}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/energy/PlanetCard.tsx
git commit -m "feat(energy): create PlanetCard component"
```

---

### Task 5: Create EnergyBalance component

**Files:**
- Create: `apps/web/src/components/energy/EnergyBalance.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface EnergyBalanceProps {
  energyProduced: number;
  energyConsumed: number;
  productionFactor: number;
}

export function EnergyBalance({ energyProduced, energyConsumed, productionFactor }: EnergyBalanceProps) {
  const surplus = energyProduced - energyConsumed;
  const sufficient = surplus >= 0;
  const ratio = energyConsumed > 0 ? Math.min(100, (energyProduced / energyConsumed) * 100) : 100;

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Bilan énergétique
        </h3>
        <div className="flex gap-4 text-xs">
          <span className="text-energy font-mono">+{energyProduced}</span>
          <span className="text-destructive font-mono">−{energyConsumed}</span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-2 rounded-full transition-[width] duration-500 ${
            sufficient ? 'bg-energy' : 'bg-destructive'
          }`}
          style={{ width: `${ratio}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-xs">
        <span className={`font-mono font-semibold ${sufficient ? 'text-energy' : 'text-destructive'}`}>
          Facteur: {(productionFactor * 100).toFixed(0)}%
        </span>
        <span className="text-muted-foreground">
          {sufficient ? `Surplus: +${surplus}` : `Déficit: ${surplus}`}
        </span>
      </div>

      {productionFactor < 1 && (
        <p className="mt-2 text-xs text-destructive">
          Production réduite — construisez une centrale solaire ou des satellites solaires !
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/energy/EnergyBalance.tsx
git commit -m "feat(energy): create EnergyBalance component"
```

---

### Task 6: Create ResourceImpact component

**Files:**
- Create: `apps/web/src/components/energy/ResourceImpact.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface ResourceRow {
  name: string;
  colorClass: string; // Tailwind text color class e.g. 'text-minerai'
  current: number;
  perHour: number;
  capacity: number;
}

interface ResourceImpactProps {
  resources: ResourceRow[];
}

export function ResourceImpact({ resources }: ResourceImpactProps) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        Impact sur les ressources
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {resources.map((r) => {
          const fillPercent = r.capacity > 0 ? Math.min(100, (r.current / r.capacity) * 100) : 0;
          return (
            <div key={r.name} className="glass-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${r.colorClass}`}>{r.name}</span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  +{r.perHour.toLocaleString('fr-FR')}/h
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-1 rounded-full transition-[width] duration-1000 ease-linear ${
                    fillPercent > 90 ? 'bg-destructive' : fillPercent > 70 ? 'bg-energy' : 'bg-primary'
                  }`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">
                  {r.current.toLocaleString('fr-FR')}
                </span>
                <span>/ {r.capacity.toLocaleString('fr-FR')}</span>
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

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/energy/ResourceImpact.tsx
git commit -m "feat(energy): create ResourceImpact component"
```

---

### Task 7: Create FluxView component

**Files:**
- Create: `apps/web/src/components/energy/FluxView.tsx`

This is the largest component. It includes: energy source cards, central hub, SVG animated branches, and consumer cards with knobs.

- [ ] **Step 1: Create the component**

```tsx
import { Knob } from './Knob';

interface EnergySource {
  name: string;
  icon: string;
  energy: number;
  detail: string; // e.g. "Niveau 12" or "3 × 45"
}

interface Consumer {
  key: string;
  name: string;
  icon: string;
  colorHex: string; // e.g. '#fb923c'
  colorClass: string; // e.g. 'text-minerai'
  percent: number;
  energyConsumption: number;
  production: string; // formatted e.g. "1 240 /h"
  productionLabel: string; // e.g. "Produit" or "Capacité"
}

interface FluxViewProps {
  sources: EnergySource[];
  totalEnergy: number;
  consumers: Consumer[];
  onPercentChange: (key: string, value: number) => void;
  onPercentChangeEnd: (key: string, value: number) => void;
  disabled?: boolean;
}

export function FluxView({
  sources,
  totalEnergy,
  consumers,
  onPercentChange,
  onPercentChangeEnd,
  disabled = false,
}: FluxViewProps) {
  const consumerCount = consumers.length;

  return (
    <div className="space-y-2">
      {/* Sources */}
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        Sources d'énergie
      </h3>
      <div className="flex flex-col sm:flex-row justify-center gap-3">
        {sources.map((s) => (
          <div
            key={s.name}
            className="glass-card p-4 text-center flex-1 relative overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-energy to-transparent" />
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xs text-muted-foreground">{s.name}</div>
            <div className="text-lg font-bold text-energy font-mono mt-1">+{s.energy}</div>
            <div className="text-[11px] text-muted-foreground">{s.detail}</div>
          </div>
        ))}
      </div>

      {/* Flow pipe down */}
      <div className="flex flex-col items-center py-1">
        <div className="w-0.5 h-8 bg-gradient-to-b from-energy/60 to-primary/40 rounded" />
      </div>

      {/* Energy hub */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-energy/30 bg-energy/5">
          <span className="text-xs text-muted-foreground">Production totale</span>
          <span className="text-lg font-bold text-energy font-mono">{totalEnergy}</span>
        </div>
      </div>

      {/* SVG Branches */}
      <svg
        viewBox={`0 0 ${consumerCount * 190} 40`}
        className="w-full max-w-3xl mx-auto h-10"
        preserveAspectRatio="xMidYMid meet"
      >
        {consumers.map((c, i) => {
          const totalWidth = consumerCount * 190;
          const centerX = totalWidth / 2;
          const targetX = i * 190 + 95;
          return (
            <g key={c.key}>
              <path
                d={`M ${centerX} 0 Q ${centerX} 20, ${targetX} 20 L ${targetX} 40`}
                fill="none"
                stroke={c.colorHex}
                strokeWidth="1.5"
                opacity={c.percent > 0 ? 0.4 : 0.1}
              />
              <circle
                cx={targetX}
                cy={34}
                r={3}
                fill={c.colorHex}
                opacity={c.percent > 0 ? 0.6 : 0.15}
                className={c.percent > 0 ? 'animate-flow-pulse' : ''}
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            </g>
          );
        })}
      </svg>

      {/* Consumer cards */}
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        Distribution
      </h3>
      <div className={`grid gap-3 ${consumerCount <= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {consumers.map((c) => (
          <div
            key={c.key}
            className="glass-card p-3 text-center relative overflow-hidden"
          >
            {/* Color accent top */}
            <div
              className="absolute inset-x-0 top-0 h-0.5"
              style={{ background: `linear-gradient(90deg, transparent, ${c.colorHex}, transparent)` }}
            />

            <div className="text-xl mb-1">{c.icon}</div>
            <div className="text-xs text-muted-foreground mb-2">{c.name}</div>

            {/* Knob */}
            <div className="flex justify-center mb-2">
              <Knob
                value={c.percent}
                onChange={(v) => onPercentChange(c.key, v)}
                onChangeEnd={(v) => onPercentChangeEnd(c.key, v)}
                color={c.colorHex}
                size="md"
                disabled={disabled}
              />
            </div>

            {/* Consumption */}
            <div className="h-0.5 w-full rounded bg-muted overflow-hidden mb-1.5">
              <div
                className="h-0.5 rounded transition-[width] duration-200"
                style={{ width: `${c.percent}%`, backgroundColor: c.colorHex }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              Consomme <span className={`font-mono font-semibold ${c.colorClass}`}>{c.energyConsumption}</span>
            </div>

            {/* Production */}
            <div className="mt-2 pt-2 border-t border-border/30">
              <div className="text-[10px] text-muted-foreground">{c.productionLabel}</div>
              <div className={`text-sm font-mono font-semibold ${c.colorClass}`}>{c.production}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/energy/FluxView.tsx
git commit -m "feat(energy): create FluxView component with SVG flow diagram"
```

---

### Task 8: Create TableView component

**Files:**
- Create: `apps/web/src/components/energy/TableView.tsx`

- [ ] **Step 1: Create the component**

Reuses the same `Consumer` and `EnergySource` interfaces from FluxView. We define them inline here to keep files independent.

```tsx
import { Knob } from './Knob';

interface EnergySource {
  name: string;
  icon: string;
  energy: number;
  detail: string;
}

interface Consumer {
  key: string;
  name: string;
  icon: string;
  level: number;
  colorHex: string;
  colorClass: string;
  percent: number;
  energyConsumption: number;
  production: string;
  productionUnit: string; // e.g. "/heure" or "/tour"
  stock?: { current: number; capacity: number };
}

interface TableViewProps {
  sources: EnergySource[];
  consumers: Consumer[];
  energySurplus: number;
  productionFactor: number;
  energyProduced: number;
  energyConsumed: number;
  onPercentChange: (key: string, value: number) => void;
  onPercentChangeEnd: (key: string, value: number) => void;
  disabled?: boolean;
}

export function TableView({
  sources,
  consumers,
  energySurplus,
  productionFactor,
  energyProduced,
  energyConsumed,
  onPercentChange,
  onPercentChangeEnd,
  disabled = false,
}: TableViewProps) {
  const sufficient = energySurplus >= 0;

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2fr_56px_1fr_1fr] sm:grid-cols-[2fr_64px_1fr_1fr_1fr] items-center px-4 py-2.5 bg-black/20 border-b border-border/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <span>Bâtiment</span>
        <span className="text-center">Alloc.</span>
        <span className="text-center">Énergie</span>
        <span className="text-center">Prod.</span>
        <span className="text-center hidden sm:block">Stock</span>
      </div>

      {/* Sources section */}
      <div className="px-4 py-1.5 bg-energy/5 border-b border-border/20 text-[10px] font-semibold text-energy uppercase tracking-wider">
        ▸ Sources
      </div>
      {sources.map((s) => (
        <div
          key={s.name}
          className="grid grid-cols-[2fr_56px_1fr_1fr] sm:grid-cols-[2fr_64px_1fr_1fr_1fr] items-center px-4 py-3 border-b border-border/10 bg-energy/[0.02]"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{s.icon}</span>
            <div>
              <div className="text-sm font-medium text-foreground">{s.name}</div>
              <div className="text-[11px] text-muted-foreground">{s.detail}</div>
            </div>
          </div>
          <div className="text-center">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-energy/10 text-energy border border-energy/20 font-semibold uppercase">
              source
            </span>
          </div>
          <div className="text-center text-sm font-mono font-semibold text-energy">+{s.energy}</div>
          <div className="text-center text-muted-foreground">—</div>
          <div className="text-center text-muted-foreground hidden sm:block">—</div>
        </div>
      ))}

      {/* Consumers section */}
      <div className="px-4 py-1.5 border-b border-border/20 text-[10px] font-semibold text-destructive uppercase tracking-wider">
        ▸ Consommateurs
      </div>
      {consumers.map((c) => (
        <div
          key={c.key}
          className="grid grid-cols-[2fr_56px_1fr_1fr] sm:grid-cols-[2fr_64px_1fr_1fr_1fr] items-center px-4 py-3 border-b border-border/10 hover:bg-accent/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{c.icon}</span>
            <div>
              <div className="text-sm font-medium text-foreground">{c.name}</div>
              <div className="text-[11px] text-muted-foreground">Niveau {c.level}</div>
            </div>
          </div>
          <div className="flex justify-center">
            <Knob
              value={c.percent}
              onChange={(v) => onPercentChange(c.key, v)}
              onChangeEnd={(v) => onPercentChangeEnd(c.key, v)}
              color={c.colorHex}
              size="sm"
              disabled={disabled}
            />
          </div>
          <div className="text-center text-sm font-mono font-semibold text-destructive">
            −{c.energyConsumption}
          </div>
          <div className="text-center">
            <div className={`text-sm font-mono font-semibold ${c.colorClass}`}>
              {c.production}
            </div>
            <div className="text-[10px] text-muted-foreground">{c.productionUnit}</div>
          </div>
          <div className="text-center hidden sm:block">
            {c.stock ? (
              <div>
                <div className="text-xs font-mono text-foreground">
                  {c.stock.current.toLocaleString('fr-FR')}
                </div>
                <div className="w-12 h-0.5 bg-muted rounded mx-auto mt-1 overflow-hidden">
                  <div
                    className="h-0.5 rounded"
                    style={{
                      width: `${Math.min(100, (c.stock.current / Math.max(1, c.stock.capacity)) * 100)}%`,
                      backgroundColor: c.colorHex,
                    }}
                  />
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  / {c.stock.capacity.toLocaleString('fr-FR')}
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </div>
      ))}

      {/* Balance row */}
      <div className="grid grid-cols-[2fr_56px_1fr_1fr] sm:grid-cols-[2fr_64px_1fr_1fr_1fr] items-center px-4 py-3 bg-energy/5 border-t border-energy/20">
        <span className="text-sm font-bold text-energy tracking-wide">⚡ BILAN</span>
        <div />
        <div className={`text-center text-lg font-mono font-bold ${sufficient ? 'text-energy' : 'text-destructive'}`}>
          {energySurplus >= 0 ? '+' : ''}{energySurplus}
        </div>
        <div className="text-center">
          <div className={`text-base font-mono font-bold ${sufficient ? 'text-energy' : 'text-destructive'}`}>
            {(productionFactor * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-muted-foreground">facteur</div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-1.5 rounded-full ${sufficient ? 'bg-energy' : 'bg-destructive'}`}
              style={{
                width: `${Math.min(100, (energyProduced / Math.max(1, energyConsumed)) * 100)}%`,
              }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
            {energyProduced}/{energyConsumed}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/energy/TableView.tsx
git commit -m "feat(energy): create TableView component with mini knobs"
```

---

### Task 9: Create Energy page

**Files:**
- Create: `apps/web/src/pages/Energy.tsx`

This is the main orchestrator that wires up data from tRPC queries to all sub-components.

- [ ] **Step 1: Create the page**

```tsx
import { useState, useCallback } from 'react';
import { useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { useGameConfig } from '@/hooks/useGameConfig';
import { buildProductionConfig } from '@/lib/production-config';
import { solarSatelliteEnergy, calculateShieldCapacity } from '@exilium/game-engine';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { PlanetCard } from '@/components/energy/PlanetCard';
import { FluxView } from '@/components/energy/FluxView';
import { TableView } from '@/components/energy/TableView';
import { EnergyBalance } from '@/components/energy/EnergyBalance';
import { ResourceImpact } from '@/components/energy/ResourceImpact';

type View = 'flux' | 'table';

export default function Energy() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const utils = trpc.useUtils();
  const { data: gameConfig } = useGameConfig();
  const [activeView, setActiveView] = useState<View>('flux');

  const { data, isLoading } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const resources = useResourceCounter(
    data
      ? {
          minerai: data.minerai,
          silicium: data.silicium,
          hydrogene: data.hydrogene,
          resourcesUpdatedAt: data.resourcesUpdatedAt,
          mineraiPerHour: data.rates.mineraiPerHour,
          siliciumPerHour: data.rates.siliciumPerHour,
          hydrogenePerHour: data.rates.hydrogenePerHour,
          storageMineraiCapacity: data.rates.storageMineraiCapacity,
          storageSiliciumCapacity: data.rates.storageSiliciumCapacity,
          storageHydrogeneCapacity: data.rates.storageHydrogeneCapacity,
        }
      : undefined,
  );

  const { data: buildings } = trpc.building.list.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const setPercentMutation = trpc.resource.setProductionPercent.useMutation({
    onSuccess: () => utils.resource.production.invalidate({ planetId: planetId! }),
  });

  const setShieldMutation = trpc.resource.setShieldPercent.useMutation({
    onSuccess: () => utils.resource.production.invalidate({ planetId: planetId! }),
  });

  // Optimistic local state for knob dragging
  const [localPercents, setLocalPercents] = useState<Record<string, number>>({});

  const handlePercentChange = useCallback((key: string, value: number) => {
    setLocalPercents((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePercentChangeEnd = useCallback(
    (key: string, value: number) => {
      setLocalPercents((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      if (key === 'shield') {
        setShieldMutation.mutate({ planetId: planetId!, percent: value });
      } else {
        setPercentMutation.mutate({ planetId: planetId!, [key]: value });
      }
    },
    [planetId, setPercentMutation, setShieldMutation],
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <PageHeader title="Énergie" />
        <CardGridSkeleton count={4} />
      </div>
    );
  }

  // Compute derived data
  const isHomePlanet = data.planetClassId === 'homeworld';
  const prodConfig = gameConfig ? buildProductionConfig(gameConfig) : undefined;
  const satEnergyPerUnit = solarSatelliteEnergy(data.maxTemp, isHomePlanet, prodConfig?.satellite);
  const satCount = data.levels.solarSatelliteCount;
  const satEnergyTotal = satEnergyPerUnit * satCount;
  const plantEnergy = data.rates.energyProduced - satEnergyTotal;

  const shieldLevel = buildings?.find((b) => b.id === 'planetaryShield')?.currentLevel ?? 0;
  const shieldPercent = localPercents['shield'] ?? data.rates.shieldPercent ?? 100;

  // Build source list
  const energySources = [
    { name: 'Centrale Solaire', icon: '☀️', energy: plantEnergy, detail: `Niveau ${data.levels.solarPlant}` },
    ...(satCount > 0
      ? [{ name: 'Satellites Solaires', icon: '🛰️', energy: satEnergyTotal, detail: `${satCount} × ${satEnergyPerUnit}` }]
      : []),
  ];

  // Build consumer list
  const consumers = [
    {
      key: 'mineraiMinePercent',
      name: 'Mine Minerai',
      icon: '⛏️',
      level: data.levels.mineraiMine,
      colorHex: '#fb923c',
      colorClass: 'text-minerai',
      percent: localPercents['mineraiMinePercent'] ?? data.rates.mineraiMinePercent,
      energyConsumption: data.rates.mineraiMineEnergyConsumption,
      production: data.rates.mineraiPerHour.toLocaleString('fr-FR'),
      productionLabel: 'Produit',
      productionUnit: '/heure',
      stock: {
        current: resources.minerai,
        capacity: data.rates.storageMineraiCapacity,
      },
    },
    {
      key: 'siliciumMinePercent',
      name: 'Mine Silicium',
      icon: '💎',
      level: data.levels.siliciumMine,
      colorHex: '#34d399',
      colorClass: 'text-silicium',
      percent: localPercents['siliciumMinePercent'] ?? data.rates.siliciumMinePercent,
      energyConsumption: data.rates.siliciumMineEnergyConsumption,
      production: data.rates.siliciumPerHour.toLocaleString('fr-FR'),
      productionLabel: 'Produit',
      productionUnit: '/heure',
      stock: {
        current: resources.silicium,
        capacity: data.rates.storageSiliciumCapacity,
      },
    },
    {
      key: 'hydrogeneSynthPercent',
      name: 'Synth. H₂',
      icon: '🧪',
      level: data.levels.hydrogeneSynth,
      colorHex: '#60a5fa',
      colorClass: 'text-hydrogene',
      percent: localPercents['hydrogeneSynthPercent'] ?? data.rates.hydrogeneSynthPercent,
      energyConsumption: data.rates.hydrogeneSynthEnergyConsumption,
      production: data.rates.hydrogenePerHour.toLocaleString('fr-FR'),
      productionLabel: 'Produit',
      productionUnit: '/heure',
      stock: {
        current: resources.hydrogene,
        capacity: data.rates.storageHydrogeneCapacity,
      },
    },
    ...(shieldLevel > 0
      ? [{
          key: 'shield',
          name: 'Bouclier',
          icon: '🛡️',
          level: shieldLevel,
          colorHex: '#22d3ee',
          colorClass: 'text-shield',
          percent: shieldPercent,
          energyConsumption: data.rates.shieldEnergyConsumption,
          production: String(Math.floor(calculateShieldCapacity(shieldLevel) * shieldPercent / 100)),
          productionLabel: 'Capacité',
          productionUnit: '/tour',
        }]
      : []),
  ];

  const resourceRows = [
    { name: 'Minerai', colorClass: 'text-minerai', current: resources.minerai, perHour: data.rates.mineraiPerHour, capacity: data.rates.storageMineraiCapacity },
    { name: 'Silicium', colorClass: 'text-silicium', current: resources.silicium, perHour: data.rates.siliciumPerHour, capacity: data.rates.storageSiliciumCapacity },
    { name: 'Hydrogène', colorClass: 'text-hydrogene', current: resources.hydrogene, perHour: data.rates.hydrogenePerHour, capacity: data.rates.storageHydrogeneCapacity },
  ];

  const isMutating = setPercentMutation.isPending || setShieldMutation.isPending;

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader title="Énergie" />

      {/* Planet Card */}
      <PlanetCard
        name={data.planetName}
        planetTypeName={data.planetTypeName}
        maxTemp={data.maxTemp}
        bonus={data.planetTypeBonus}
      />

      {/* View tabs */}
      <div className="flex gap-0.5 bg-card/50 rounded-lg p-0.5 border border-border/30 w-fit">
        <button
          onClick={() => setActiveView('flux')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'flux'
              ? 'bg-energy/10 text-energy'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ⚡ Flux
        </button>
        <button
          onClick={() => setActiveView('table')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'table'
              ? 'bg-energy/10 text-energy'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          📊 Tableau
        </button>
      </div>

      {/* Active view */}
      {activeView === 'flux' ? (
        <FluxView
          sources={energySources}
          totalEnergy={data.rates.energyProduced}
          consumers={consumers}
          onPercentChange={handlePercentChange}
          onPercentChangeEnd={handlePercentChangeEnd}
          disabled={isMutating}
        />
      ) : (
        <TableView
          sources={energySources}
          consumers={consumers}
          energySurplus={data.rates.energyProduced - data.rates.energyConsumed}
          productionFactor={data.rates.productionFactor}
          energyProduced={data.rates.energyProduced}
          energyConsumed={data.rates.energyConsumed}
          onPercentChange={handlePercentChange}
          onPercentChangeEnd={handlePercentChangeEnd}
          disabled={isMutating}
        />
      )}

      {/* Energy balance (common to both views) */}
      <EnergyBalance
        energyProduced={data.rates.energyProduced}
        energyConsumed={data.rates.energyConsumed}
        productionFactor={data.rates.productionFactor}
      />

      {/* Resource impact (common to both views) */}
      <ResourceImpact resources={resourceRows} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors (might need to fix type issues with new API fields — see notes below)

**Note:** If `data.planetName` or `data.planetTypeName` cause type errors, the tRPC client types need to be regenerated. This happens automatically after the backend changes from Task 1 are compiled.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Energy.tsx
git commit -m "feat(energy): create Energy page assembling all components"
```

---

### Task 10: Update routing, navigation, and cleanup

**Files:**
- Modify: `apps/web/src/router.tsx:68-72`
- Modify: `apps/web/src/components/layout/Sidebar.tsx:34`
- Modify: `apps/web/src/components/layout/BottomTabBar.tsx` (if references resources)
- Delete: `apps/web/src/pages/Resources.tsx`

- [ ] **Step 1: Update router**

In `apps/web/src/router.tsx`, replace the resources route (lines 68-72) with the energy route and add a redirect for old URLs:

```typescript
// Replace this:
{
  path: 'resources',
  lazy: lazyLoad(() => import('./pages/Resources')),
  errorElement: <ErrorBoundary><RouteErrorFallback /></ErrorBoundary>,
},

// With this:
{
  path: 'energy',
  lazy: lazyLoad(() => import('./pages/Energy')),
  errorElement: <ErrorBoundary><RouteErrorFallback /></ErrorBoundary>,
},
{
  path: 'resources',
  element: <Navigate to="/energy" replace />,
},
```

`Navigate` is already imported at line 1.

- [ ] **Step 2: Update sidebar navigation**

In `apps/web/src/components/layout/Sidebar.tsx`, change line 34:

```typescript
// Before:
{ label: 'Ressources', path: '/resources', icon: ResourcesIcon },

// After:
{ label: 'Énergie', path: '/energy', icon: ResourcesIcon },
```

Keep `ResourcesIcon` for now — it can be replaced with an energy-specific icon later.

- [ ] **Step 3: Update BottomTabBar if needed**

Check `apps/web/src/components/layout/BottomTabBar.tsx` for any reference to `/resources` and update to `/energy`.

- [ ] **Step 4: Delete old Resources page**

```bash
rm apps/web/src/pages/Resources.tsx
```

- [ ] **Step 5: Verify full build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(energy): update routing, navigation, delete old Resources page"
```

---

### Task 11: Manual testing and polish

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (or equivalent turbo command)

- [ ] **Step 2: Test the flux view**

Navigate to `/energy`. Verify:
- Planet card shows name, class, temperature, bonuses
- Sources display with correct energy values
- SVG branches render with animated dots
- Knobs are draggable (desktop) and show correct percentages
- Consumer cards display consumption and production
- Energy balance bar is correct

- [ ] **Step 3: Test the table view**

Click the "Tableau" tab. Verify:
- Sources section shows solar plant and satellites
- Consumer rows show mini knobs, energy consumption, production, stock
- Balance row shows correct surplus and factor
- Stock column is hidden on mobile

- [ ] **Step 4: Test knob interaction**

- Drag a knob up/down — value should change smoothly
- Release — API should be called (check network tab)
- Tap a knob — numeric input should appear
- Type a value, press Enter — should update

- [ ] **Step 5: Test mobile**

Resize browser to mobile width. Verify:
- Sources stack vertically
- Consumer cards are 2-column grid
- Resource impact cards stack to 1 column
- Knobs are usable with touch

- [ ] **Step 6: Test redirect**

Navigate to `/resources` — should redirect to `/energy`.

- [ ] **Step 7: Commit any polish fixes**

```bash
git add -A
git commit -m "fix(energy): polish from manual testing"
```
