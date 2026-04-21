# Colonization Reports Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four colonization-related mission reports (`colonize`, `colonize_reinforce`, `colonization_raid`, `abandon_return`) a unified visual treatment — hero banner with optional lore vignette, resource delta cards, contextual explainers, expandable raid combat — via two shared primitives.

**Architecture:** Two new primitives live in `apps/web/src/components/reports/shared/`. Each mission type gets its own detail component that composes the primitives. `ReportDetail.tsx` wires three new branches and suppresses the generic fleet summary for the four colonization types. No backend changes.

**Tech Stack:** React + TypeScript + Tailwind, tRPC (read-only `trpc.planet.list` for one component), inline SVGs for per-outcome icons.

**Spec:** [`docs/superpowers/specs/2026-04-21-colonization-reports-redesign-design.md`](../specs/2026-04-21-colonization-reports-redesign-design.md)

**Dependency map (for parallelism):**
- Tasks 1 and 2 are independent → parallel wave 1
- Tasks 3, 4, 5, 6 each depend on 1 + 2 but not on each other → parallel wave 2
- Task 7 depends on 3, 4, 5 (imports them) — serial after wave 2

---

## Task 1: `ReportHero` primitive

**Files:**
- Create: `apps/web/src/components/reports/shared/ReportHero.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react';
import { CoordsLink } from '@/components/common/CoordsLink';
import { PlanetDot } from '@/components/galaxy/PlanetDot';
import { cn } from '@/lib/utils';

type HeroStatus = 'success' | 'warning' | 'danger' | 'neutral';

interface ReportHeroProps {
  coords: { galaxy: number; system: number; position: number };
  title: string;
  statusLabel: string;
  status: HeroStatus;
  planetClassId?: string;
  icon?: ReactNode;
  lore?: string;
}

const STATUS_STYLES: Record<HeroStatus, { gradient: string; accent: string; border: string }> = {
  success: {
    gradient: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.18) 0%, rgba(15, 23, 42, 0.95) 70%)',
    accent: 'text-emerald-300',
    border: 'border-emerald-500/30',
  },
  warning: {
    gradient: 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.18) 0%, rgba(15, 23, 42, 0.95) 70%)',
    accent: 'text-amber-300',
    border: 'border-amber-500/30',
  },
  danger: {
    gradient: 'radial-gradient(ellipse at center, rgba(244, 63, 94, 0.18) 0%, rgba(15, 23, 42, 0.95) 70%)',
    accent: 'text-rose-300',
    border: 'border-rose-500/30',
  },
  neutral: {
    gradient: 'radial-gradient(ellipse at center, rgba(100, 116, 139, 0.18) 0%, rgba(15, 23, 42, 0.95) 70%)',
    accent: 'text-slate-300',
    border: 'border-slate-500/30',
  },
};

export function ReportHero({ coords, title, statusLabel, status, planetClassId, icon, lore }: ReportHeroProps) {
  const styles = STATUS_STYLES[status];
  return (
    <div
      className={cn('rounded-lg border p-4 flex items-center gap-4', styles.border)}
      style={{ background: styles.gradient }}
    >
      <div className="shrink-0 w-[72px] h-[72px] flex items-center justify-center">
        {planetClassId ? <PlanetDot planetClassId={planetClassId} size={72} /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn('text-[10px] uppercase tracking-[0.15em] font-medium', styles.accent)}>
          {statusLabel}
        </div>
        <h2 className="text-lg font-bold text-foreground mt-1 truncate">{title}</h2>
        <div className="text-[11px] font-mono text-muted-foreground mt-1">
          <CoordsLink galaxy={coords.galaxy} system={coords.system} position={coords.position} />
        </div>
        {lore && (
          <p className="text-xs italic text-muted-foreground/90 mt-2 leading-relaxed">{lore}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @exilium/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/components/reports/shared/ReportHero.tsx
git commit -m "feat(reports): ReportHero shared primitive

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push
```

---

## Task 2: `ResourceDeltaCard` primitive

**Files:**
- Create: `apps/web/src/components/reports/shared/ResourceDeltaCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from '@/components/common/ResourceIcons';
import { cn } from '@/lib/utils';

type Variant = 'loss' | 'gain' | 'debris' | 'neutral';

interface ResourceDeltaCardProps {
  title: string;
  cargo: { minerai?: number; silicium?: number; hydrogene?: number };
  variant: Variant;
  explainer?: string;
}

const VARIANT_STYLES: Record<Variant, { text: string; border: string; bg: string; prefix: string }> = {
  gain: { text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', prefix: '+' },
  loss: { text: 'text-rose-400', border: 'border-rose-500/20', bg: 'bg-rose-500/5', prefix: '−' },
  debris: { text: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5', prefix: '' },
  neutral: { text: 'text-foreground', border: 'border-border', bg: '', prefix: '' },
};

const fmt = (n: number) => Math.floor(n).toLocaleString('fr-FR');

export function ResourceDeltaCard({ title, cargo, variant, explainer }: ResourceDeltaCardProps) {
  const styles = VARIANT_STYLES[variant];
  const minerai = cargo.minerai ?? 0;
  const silicium = cargo.silicium ?? 0;
  const hydrogene = cargo.hydrogene ?? 0;
  if (minerai <= 0 && silicium <= 0 && hydrogene <= 0) return null;

  return (
    <div className={cn('glass-card p-4 border', styles.border, styles.bg)}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      <div className="flex flex-wrap gap-4 text-sm">
        {minerai > 0 && (
          <span className="flex items-center gap-1.5">
            <MineraiIcon size={14} className="text-minerai" />
            <span className={cn('tabular-nums font-medium', styles.text)}>
              {styles.prefix}{fmt(minerai)}
            </span>
          </span>
        )}
        {silicium > 0 && (
          <span className="flex items-center gap-1.5">
            <SiliciumIcon size={14} className="text-silicium" />
            <span className={cn('tabular-nums font-medium', styles.text)}>
              {styles.prefix}{fmt(silicium)}
            </span>
          </span>
        )}
        {hydrogene > 0 && (
          <span className="flex items-center gap-1.5">
            <HydrogeneIcon size={14} className="text-hydrogene" />
            <span className={cn('tabular-nums font-medium', styles.text)}>
              {styles.prefix}{fmt(hydrogene)}
            </span>
          </span>
        )}
      </div>
      {explainer && <p className="text-[11px] text-muted-foreground mt-2 italic">{explainer}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @exilium/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/components/reports/shared/ResourceDeltaCard.tsx
git commit -m "feat(reports): ResourceDeltaCard shared primitive

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push
```

---

## Task 3: `ColonizeReportDetail`

Covers three outcomes: landing success, asteroid belt, position occupied.

**Files:**
- Create: `apps/web/src/components/reports/ColonizeReportDetail.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Link } from 'react-router';
import { trpc } from '@/trpc';
import { ReportHero } from './shared/ReportHero';
import { getShipName } from '@/lib/entity-names';

interface Props {
  result: Record<string, any>;
  fleet: { ships: Record<string, number>; totalCargo: number };
  gameConfig: any;
  coordinates: { galaxy: number; system: number; position: number };
}

function AsteroidIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#94a3b8" strokeWidth="1.5">
      <ellipse cx="22" cy="34" rx="11" ry="8" fill="#334155" />
      <ellipse cx="46" cy="28" rx="8" ry="6" fill="#475569" />
      <ellipse cx="40" cy="48" rx="10" ry="7" fill="#334155" />
      <circle cx="56" cy="44" r="3" fill="#64748b" />
      <circle cx="14" cy="48" r="2" fill="#64748b" />
      <circle cx="58" cy="22" r="1.5" fill="#64748b" />
    </svg>
  );
}

function OccupiedIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none">
      <circle cx="36" cy="36" r="24" fill="#78350f" stroke="#fbbf24" strokeWidth="1.5" />
      <circle cx="36" cy="36" r="24" fill="#fbbf24" opacity="0.15" />
      <rect x="29" y="34" width="14" height="11" rx="1.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.5" />
      <path d="M32 34 V29 a4 4 0 0 1 8 0 V34" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
    </svg>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#fbbf24' : 'none'} stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 2 L15 9 L22 9 L17 14 L19 22 L12 17 L5 22 L7 14 L2 9 L9 9 Z" />
    </svg>
  );
}

function ShipGrid({ ships, gameConfig }: { ships: Record<string, number>; gameConfig: any }) {
  const entries = Object.entries(ships).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([id, n]) => (
        <span key={id} className="text-sm">
          <span className="text-foreground font-medium">{n}x</span>{' '}
          <span className="text-muted-foreground">{id === 'flagship' ? (gameConfig?.ships?.flagship?.name ?? 'Vaisseau amiral') : getShipName(id, gameConfig)}</span>
        </span>
      ))}
    </div>
  );
}

export function ColonizeReportDetail({ result, fleet, gameConfig, coordinates }: Props) {
  // Success
  if (result.success === true) {
    const planetId = result.planetId as string | undefined;
    const difficulty = Number(result.difficulty ?? 0);
    const { data: planets } = trpc.planet.list.useQuery();
    const newPlanet = planetId ? planets?.find((p: any) => p.id === planetId) : undefined;
    const planetClassId = newPlanet?.planetClassId ?? undefined;

    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates}
          title="Nouvelle colonie"
          statusLabel="Débarquement réussi"
          status="success"
          planetClassId={planetClassId}
          lore="Les premiers modules s'enfoncent dans le régolithe. Le drapeau de votre empire flotte au-dessus d'un monde encore sauvage."
        />

        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Colonie en construction
          </h3>
          <p className="text-sm text-muted-foreground">
            Les opérations de terraformation ont commencé.
          </p>
          {planetId && (
            <Link
              to={`/colonization/${planetId}`}
              className="inline-block mt-3 text-sm text-cyan-400 hover:text-cyan-300 underline"
            >
              Suivre l'avancement →
            </Link>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Difficulté du monde
          </h3>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} filled={i <= difficulty} />)}
            <span className="ml-2 text-sm text-muted-foreground tabular-nums">{difficulty}/5</span>
          </div>
          {difficulty >= 4 && (
            <p className="text-[11px] text-muted-foreground mt-2 italic">
              Colonisation longue, raids plus fréquents.
            </p>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Flotte débarquée
          </h3>
          <ShipGrid ships={fleet.ships} gameConfig={gameConfig} />
        </div>
      </div>
    );
  }

  // Asteroid belt
  if (result.reason === 'asteroid_belt') {
    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates}
          title="Position inhabitable"
          statusLabel="Ceinture d'astéroïdes"
          status="neutral"
          icon={<AsteroidIcon />}
          lore="Le vaisseau colonial n'a trouvé qu'un champ de poussières et de roches."
        />
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raison</h3>
          <p className="text-sm">Ceinture d'astéroïdes. Un recycleur peut exploiter le champ.</p>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte rappelée</h3>
          <ShipGrid ships={fleet.ships} gameConfig={gameConfig} />
        </div>
      </div>
    );
  }

  // Position occupied
  if (result.reason === 'occupied') {
    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates}
          title="Position déjà colonisée"
          statusLabel="Arrivée annulée"
          status="warning"
          icon={<OccupiedIcon />}
        />
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raison</h3>
          <p className="text-sm">Une colonie occupe déjà cette position.</p>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte rappelée</h3>
          <ShipGrid ships={fleet.ships} gameConfig={gameConfig} />
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @exilium/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/components/reports/ColonizeReportDetail.tsx
git commit -m "feat(reports): ColonizeReportDetail with 3 outcomes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push
```

---

## Task 4: `ColonizeReinforceReportDetail`

Covers two outcomes: delivered, aborted.

**Files:**
- Create: `apps/web/src/components/reports/ColonizeReinforceReportDetail.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { ReportHero } from './shared/ReportHero';
import { ResourceDeltaCard } from './shared/ResourceDeltaCard';
import { getShipName } from '@/lib/entity-names';

interface Props {
  result: Record<string, any>;
  fleet: { ships: Record<string, number>; totalCargo: number };
  gameConfig: any;
  coordinates: { galaxy: number; system: number; position: number };
}

function CargoDeliveredIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round">
      <rect x="18" y="30" width="36" height="28" rx="2" fill="#065f46" />
      <line x1="18" y1="42" x2="54" y2="42" />
      <line x1="36" y1="30" x2="36" y2="58" />
      <path d="M36 10 v14" />
      <path d="M28 20 l8 8 l8 -8" fill="none" />
    </svg>
  );
}

function EmptyDockIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#fbbf24" strokeWidth="2">
      <path d="M14 54 h44" />
      <path d="M18 54 v-22" />
      <path d="M54 54 v-22" />
      <text x="36" y="44" textAnchor="middle" fill="#fbbf24" fontSize="22" fontFamily="sans-serif" fontWeight="bold" stroke="none">?</text>
    </svg>
  );
}

function ShipGrid({ ships, gameConfig }: { ships: Record<string, number>; gameConfig: any }) {
  const entries = Object.entries(ships).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([id, n]) => (
        <span key={id} className="text-sm">
          <span className="text-foreground font-medium">{n}x</span>{' '}
          <span className="text-muted-foreground">{id === 'flagship' ? (gameConfig?.ships?.flagship?.name ?? 'Vaisseau amiral') : getShipName(id, gameConfig)}</span>
        </span>
      ))}
    </div>
  );
}

export function ColonizeReinforceReportDetail({ result, fleet, gameConfig, coordinates }: Props) {
  // Aborted
  if (result.aborted === true) {
    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates}
          title="Mission annulée"
          statusLabel="Cible non trouvée"
          status="warning"
          icon={<EmptyDockIcon />}
          lore="À l'arrivée, plus rien à défendre."
        />
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raison</h3>
          <p className="text-sm">La colonisation est terminée ou a été abandonnée.</p>
        </div>
        <div className="glass-card p-4 text-xs text-muted-foreground italic">
          La flotte et son cargo reviennent à leur planète d'origine (rapport d'arrivée séparé).
        </div>
      </div>
    );
  }

  // Delivered
  const stationed = (result.stationed as Record<string, number>) ?? {};
  const deposited = (result.deposited as { minerai: number; silicium: number; hydrogene: number }) ?? { minerai: 0, silicium: 0, hydrogene: 0 };
  const shipsToShow = Object.keys(stationed).length > 0 ? stationed : fleet.ships;

  return (
    <div className="space-y-4">
      <ReportHero
        coords={coordinates}
        title="Renforts livrés"
        statusLabel="Colonisation en cours"
        status="success"
        icon={<CargoDeliveredIcon />}
      />
      <ResourceDeltaCard title="Cargo livré" cargo={deposited} variant="gain" />
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Ships intégrés à la garnison
        </h3>
        <ShipGrid ships={shipsToShow} gameConfig={gameConfig} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @exilium/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/components/reports/ColonizeReinforceReportDetail.tsx
git commit -m "feat(reports): ColonizeReinforceReportDetail with delivered + aborted

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push
```

---

## Task 5: `ColonizationRaidReportDetail`

Covers four outcomes: no-garrison pillage, combat won, combat draw, combat lost.

**Files:**
- Create: `apps/web/src/components/reports/ColonizationRaidReportDetail.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react';
import { ReportHero } from './shared/ReportHero';
import { ResourceDeltaCard } from './shared/ResourceDeltaCard';
import { CombatReportDetail } from './CombatReportDetail';
import { getShipName } from '@/lib/entity-names';
import { cn } from '@/lib/utils';

interface Props {
  result: Record<string, any>;
  fleet: { ships: Record<string, number>; totalCargo: number };
  gameConfig: any;
  coordinates: { galaxy: number; system: number; position: number };
  reportId: string;
}

function PirateIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#fb7185" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8 50 l14 -10 h28 l14 10 l-10 8 h-36 Z" fill="#7f1d1d" />
      <circle cx="36" cy="26" r="11" fill="#0f172a" stroke="#fb7185" />
      <circle cx="32" cy="25" r="2" fill="#fb7185" stroke="none" />
      <circle cx="40" cy="25" r="2" fill="#fb7185" stroke="none" />
      <path d="M32 32 l2 2 l2 -2 l2 2 l2 -2" />
      <path d="M22 46 l-4 -10" />
      <path d="M50 46 l4 -10" />
    </svg>
  );
}

function ShipGrid({ ships, gameConfig }: { ships: Record<string, number>; gameConfig: any }) {
  const entries = Object.entries(ships).filter(([, n]) => n > 0);
  if (entries.length === 0) return <span className="text-xs text-muted-foreground italic">Aucune</span>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {entries.map(([id, n]) => (
        <span key={id} className="text-sm">
          <span className="text-foreground font-medium">{n}x</span>{' '}
          <span className="text-muted-foreground">{id === 'flagship' ? (gameConfig?.ships?.flagship?.name ?? 'Vaisseau amiral') : getShipName(id, gameConfig)}</span>
        </span>
      ))}
    </div>
  );
}

function fmt(n: number) { return Math.round(n).toLocaleString('fr-FR'); }

export function ColonizationRaidReportDetail({ result, fleet, gameConfig, coordinates, reportId: _reportId }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const progressPenalty = Number(result.progressPenalty ?? 0);
  const pillage = (result.pillaged ?? result.pillage ?? { minerai: 0, silicium: 0, hydrogene: 0 }) as { minerai: number; silicium: number; hydrogene: number };

  // No garrison variant
  if (result.hasGarrison === false) {
    const pirateFleet = (result.pirateFleet as Record<string, number>) ?? fleet.ships;
    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates}
          title="Pillage sans résistance"
          statusLabel="Raid pirate"
          status="danger"
          icon={<PirateIcon />}
          lore="Les pirates ont pillé le chantier. Votre embryon de colonie saigne."
        />
        <ResourceDeltaCard
          title="Pillé"
          cargo={pillage}
          variant="loss"
          explainer="Déployez une garnison pour limiter les prochains pillages."
        />
        <div className="glass-card p-4 border border-rose-500/20 bg-rose-500/5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Progression perdue
          </h3>
          <div className="text-lg font-bold text-rose-400 tabular-nums">−{fmt(progressPenalty)}%</div>
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            La colonisation a reculé.
          </p>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte pirate</h3>
          <ShipGrid ships={pirateFleet} gameConfig={gameConfig} />
        </div>
      </div>
    );
  }

  // Combat variants
  const outcome = result.outcome as 'attacker' | 'defender' | 'draw';
  const attackerFP = Number(result.attackerFP ?? 0);
  const defenderFP = Number(result.defenderFP ?? 0);
  const totalFP = attackerFP + defenderFP || 1;
  const roundCount = Number(result.roundCount ?? 0);
  const defenderLosses = (result.defenderLosses as Record<string, number>) ?? {};
  const attackerLosses = (result.attackerLosses as Record<string, number>) ?? {};

  let heroProps: { title: string; statusLabel: string; status: 'success' | 'warning' | 'danger'; lore?: string };
  if (outcome === 'defender') {
    heroProps = { title: 'Raid repoussé', statusLabel: 'Garnison victorieuse', status: 'success', lore: 'Les pirates ont battu en retraite.' };
  } else if (outcome === 'draw') {
    heroProps = { title: 'Raid contenu', statusLabel: 'Égalité', status: 'warning' };
  } else {
    heroProps = { title: 'Garnison défaite', statusLabel: 'Raid pirate', status: 'danger', lore: 'Les défenseurs ont tenu, puis cédé.' };
  }

  const outcomeText = outcome === 'defender' ? 'Garnison victorieuse' : outcome === 'draw' ? 'Match nul' : 'Pirates victorieux';

  return (
    <div className="space-y-4">
      <ReportHero
        coords={coordinates}
        title={heroProps.title}
        statusLabel={heroProps.statusLabel}
        status={heroProps.status}
        icon={<PirateIcon />}
        lore={heroProps.lore}
      />

      {/* Combat summary card */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Résumé combat</h3>

        {/* FP bar */}
        <div>
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>Pirates · <span className="text-rose-400 tabular-nums">{fmt(attackerFP)}</span> FP</span>
            <span><span className="text-cyan-400 tabular-nums">{fmt(defenderFP)}</span> FP · Garnison</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
            <div className="bg-rose-500/80" style={{ width: `${(attackerFP / totalFP) * 100}%` }} />
            <div className="bg-cyan-500/80" style={{ width: `${(defenderFP / totalFP) * 100}%` }} />
          </div>
        </div>

        {/* Round count + outcome label */}
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{roundCount} round{roundCount > 1 ? 's' : ''}</span>
          <span className={cn(
            'font-semibold',
            outcome === 'defender' ? 'text-emerald-400' : outcome === 'draw' ? 'text-amber-400' : 'text-rose-400',
          )}>
            {outcomeText}
          </span>
        </div>

        {/* Losses */}
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">Pertes garnison</div>
          <ShipGrid ships={defenderLosses} gameConfig={gameConfig} />
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">Pertes pirates</div>
          <ShipGrid ships={attackerLosses} gameConfig={gameConfig} />
        </div>

        <button
          type="button"
          onClick={() => setDetailOpen(!detailOpen)}
          className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-2 border-t border-border/50"
        >
          <span>{detailOpen ? 'Masquer le détail' : 'Voir le détail du combat'}</span>
          <svg className={cn('h-3 w-3 transition-transform', detailOpen && 'rotate-180')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9 l6 6 l6 -6" />
          </svg>
        </button>
      </div>

      {detailOpen && (
        <div className="border-l-2 border-border/50 pl-4">
          <CombatReportDetail result={result} missionType="pirate" gameConfig={gameConfig} coordinates={coordinates} />
        </div>
      )}

      {outcome === 'attacker' && (
        <ResourceDeltaCard title="Pillé" cargo={pillage} variant="loss" />
      )}

      {progressPenalty > 0 && (
        <div className={cn(
          'glass-card p-4 border',
          outcome === 'attacker' ? 'border-rose-500/20 bg-rose-500/5' : 'border-amber-500/20 bg-amber-500/5',
        )}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Progression perdue
          </h3>
          <div className={cn(
            'text-lg font-bold tabular-nums',
            outcome === 'attacker' ? 'text-rose-400' : 'text-amber-400',
          )}>
            −{fmt(progressPenalty)}%
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            {outcome === 'draw'
              ? 'Pénalité réduite de moitié grâce à la résistance.'
              : 'La colonisation a reculé.'}
          </p>
        </div>
      )}

      {outcome === 'defender' && progressPenalty === 0 && (
        <div className="glass-card p-4 border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-sm text-emerald-300">Aucune perte de progression — la garnison a protégé le chantier.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @exilium/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/components/reports/ColonizationRaidReportDetail.tsx
git commit -m "feat(reports): ColonizationRaidReportDetail with combat expand

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push
```

---

## Task 6: Polish `AbandonReportDetail`

Replaces the existing JSX with the new layout using shared primitives.

**Files:**
- Modify: `apps/web/src/components/reports/AbandonReportDetail.tsx` (complete rewrite)

- [ ] **Step 1: Replace the file content**

Replace the entire file with:

```tsx
import { CoordsLink } from '@/components/common/CoordsLink';
import { ReportHero } from './shared/ReportHero';
import { ResourceDeltaCard } from './shared/ResourceDeltaCard';
import { getShipName } from '@/lib/entity-names';

interface GameConfigLike {
  ships?: Record<string, { name: string }>;
  [key: string]: unknown;
}

type Cargo = { minerai: number; silicium: number; hydrogene: number };

type AbandonReportResult =
  | {
      aborted: true;
      reason: string;
      shipsLost: Record<string, number>;
      cargoLost: Cargo;
    }
  | {
      destination: {
        id: string;
        name: string;
        galaxy: number;
        system: number;
        position: number;
      };
      delivered: {
        ships: Record<string, number>;
        cargo: Cargo;
      };
      overflow: { minerai: number; silicium: number; hydrogene: number } | null;
    };

interface Props {
  result: AbandonReportResult | Record<string, any>;
  gameConfig: GameConfigLike | null | undefined;
  coordinates?: { galaxy: number; system: number; position: number };
}

function DockingIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round">
      <path d="M14 48 h44" />
      <path d="M18 48 v-12" />
      <path d="M54 48 v-12" />
      <path d="M22 30 l14 -6 l14 6 l-4 6 h-20 Z" fill="#065f46" />
      <line x1="22" y1="48" x2="22" y2="56" />
      <line x1="50" y1="48" x2="50" y2="56" />
      <line x1="36" y1="24" x2="36" y2="18" />
      <circle cx="36" cy="16" r="2" fill="#34d399" stroke="none" />
    </svg>
  );
}

function LostShipIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#f43f5e" strokeWidth="1.5">
      <path d="M10 36 l16 -10" />
      <path d="M26 26 l12 4" />
      <path d="M28 40 l10 8" />
      <path d="M38 30 l4 -8" />
      <path d="M42 22 l10 14" />
      <path d="M38 48 l8 -6" />
      <path d="M46 42 l12 -6" />
      <circle cx="14" cy="38" r="1.5" fill="#f43f5e" stroke="none" />
      <circle cx="52" cy="48" r="1.5" fill="#f43f5e" stroke="none" />
      <circle cx="44" cy="22" r="1.5" fill="#f43f5e" stroke="none" />
    </svg>
  );
}

function shipLabel(id: string, gameConfig: GameConfigLike | null | undefined) {
  if (id === 'flagship') {
    return gameConfig?.ships?.flagship?.name ?? 'Vaisseau amiral';
  }
  return getShipName(id, gameConfig);
}

function ShipGrid({ ships, gameConfig }: { ships: Record<string, number>; gameConfig: GameConfigLike | null | undefined }) {
  const entries = Object.entries(ships).filter(([, n]) => Number(n) > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([id, n]) => (
        <span key={id} className="text-sm">
          <span className="text-foreground font-medium">{Number(n).toLocaleString('fr-FR')}x</span>{' '}
          <span className="text-muted-foreground">{shipLabel(id, gameConfig)}</span>
        </span>
      ))}
    </div>
  );
}

function reasonText(reason: string): string {
  if (reason === 'destination_gone' || reason === 'destination_deleted') {
    return 'La destination n\'existe plus.';
  }
  return reason;
}

export function AbandonReportDetail({ result, gameConfig, coordinates }: Props) {
  // Lost in transit
  if ((result as any).aborted === true) {
    const r = result as Extract<AbandonReportResult, { aborted: true }>;
    const shipsLost = r.shipsLost ?? {};
    const cargoLost = r.cargoLost ?? { minerai: 0, silicium: 0, hydrogene: 0 };
    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates ?? { galaxy: 0, system: 0, position: 0 }}
          title="Convoi perdu"
          statusLabel="Retour échoué"
          status="danger"
          icon={<LostShipIcon />}
          lore="La planète de destination s'est effondrée avant l'arrivée. Le convoi erre dans le vide, sans port d'attache."
        />
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raison</h3>
          <p className="text-sm">{reasonText(r.reason ?? '')}</p>
        </div>
        {Object.keys(shipsLost).length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ships perdus</h3>
            <ShipGrid ships={shipsLost} gameConfig={gameConfig} />
          </div>
        )}
        <ResourceDeltaCard title="Ressources perdues" cargo={cargoLost} variant="loss" />
      </div>
    );
  }

  // Homecoming
  const { destination, delivered, overflow } = result as Extract<AbandonReportResult, { destination: any }>;
  return (
    <div className="space-y-4">
      <ReportHero
        coords={{ galaxy: destination.galaxy, system: destination.system, position: destination.position }}
        title={destination.name}
        statusLabel="Convoi rapatrié"
        status="success"
        icon={<DockingIcon />}
        lore="Le convoi s'amarre au port spatial. Le monde qu'il a quitté n'existe plus."
      />
      <div className="glass-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Arrivée sur{' '}
          <CoordsLink galaxy={destination.galaxy} system={destination.system} position={destination.position} />
        </h3>
        <p className="text-sm">Destination : {destination.name}</p>
      </div>
      {Object.keys(delivered.ships ?? {}).length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Ships rapatriés
          </h3>
          <ShipGrid ships={delivered.ships} gameConfig={gameConfig} />
        </div>
      )}
      <ResourceDeltaCard title="Ressources livrées" cargo={delivered.cargo} variant="gain" />
      {overflow && (
        <ResourceDeltaCard
          title="Champ de débris laissé"
          cargo={overflow}
          variant="debris"
          explainer="Recyclable par votre flotte sur l'ancienne position."
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F @exilium/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add apps/web/src/components/reports/AbandonReportDetail.tsx
git commit -m "feat(reports): polish AbandonReportDetail with shared primitives

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push
```

---

## Task 7: Wire up `ReportDetail.tsx`

Three new branches, suppress the generic "Flotte envoyée" block for the four colonization types, and pass `coordinates` to the existing `AbandonReportDetail`.

**Files:**
- Modify: `apps/web/src/pages/ReportDetail.tsx`

- [ ] **Step 1: Add the three imports**

At the top of the file, next to the other report-detail imports (around line 16), add:

```tsx
import { ColonizeReportDetail } from '@/components/reports/ColonizeReportDetail';
import { ColonizeReinforceReportDetail } from '@/components/reports/ColonizeReinforceReportDetail';
import { ColonizationRaidReportDetail } from '@/components/reports/ColonizationRaidReportDetail';
```

- [ ] **Step 2: Suppress generic fleet summary for colonization types**

Find the current block at lines 154-170:

```tsx
{/* Fleet summary (if non-empty) */}
{Object.keys(fleet.ships).length > 0 && (
  <div className="glass-card p-4">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte envoyée</h3>
    <div className="flex flex-wrap gap-3">
      {Object.entries(fleet.ships).map(([ship, count]) => (
        <span key={ship} className="text-sm">
          <span className="text-foreground font-medium">{String(count)}x</span>{' '}
          <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
        </span>
      ))}
    </div>
    <div className="mt-2 text-xs text-muted-foreground">
      Capacité cargo : {fleet.totalCargo.toLocaleString('fr-FR')}
    </div>
  </div>
)}
```

Replace with:

```tsx
{/* Fleet summary (hidden for colonization types — they render their own fleet) */}
{Object.keys(fleet.ships).length > 0 &&
  !['colonize', 'colonize_reinforce', 'colonization_raid', 'abandon_return'].includes(report.missionType) && (
  <div className="glass-card p-4">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte envoyée</h3>
    <div className="flex flex-wrap gap-3">
      {Object.entries(fleet.ships).map(([ship, count]) => (
        <span key={ship} className="text-sm">
          <span className="text-foreground font-medium">{String(count)}x</span>{' '}
          <span className="text-muted-foreground">{getShipName(ship, gameConfig)}</span>
        </span>
      ))}
    </div>
    <div className="mt-2 text-xs text-muted-foreground">
      Capacité cargo : {fleet.totalCargo.toLocaleString('fr-FR')}
    </div>
  </div>
)}
```

- [ ] **Step 3: Replace the abandon_return branch and add three new branches**

Find the existing `abandon_return` branch at line 200:

```tsx
{report.missionType === 'abandon_return' && (
  <AbandonReportDetail result={result} gameConfig={gameConfig} />
)}
```

Replace with:

```tsx
{report.missionType === 'abandon_return' && (
  <AbandonReportDetail result={result} gameConfig={gameConfig} coordinates={coords} />
)}
{report.missionType === 'colonize' && (
  <ColonizeReportDetail result={result} fleet={fleet} gameConfig={gameConfig} coordinates={coords} />
)}
{report.missionType === 'colonize_reinforce' && (
  <ColonizeReinforceReportDetail result={result} fleet={fleet} gameConfig={gameConfig} coordinates={coords} />
)}
{report.missionType === 'colonization_raid' && (
  <ColonizationRaidReportDetail result={result} fleet={fleet} gameConfig={gameConfig} coordinates={coords} reportId={report.id} />
)}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm -F @exilium/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit and push**

```bash
git add apps/web/src/pages/ReportDetail.tsx
git commit -m "feat(reports): wire colonization report detail components

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
git push
```

---

## Task 8: Manual verification

No unit tests — spec calls for visual verification in the browser.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev` (or the project's standard dev command)

- [ ] **Step 2: Trigger each outcome in a dev account**

- `colonize` success — send a colony ship to an empty position (non-asteroid-belt)
- `colonize` asteroid belt — send a colony ship to a known asteroid-belt position
- `colonize` position occupied — send a colony ship to another player's planet
- `colonize_reinforce` delivered — send ships to a colonizing planet
- `colonize_reinforce` aborted — send ships to a colonizing planet, abandon it before arrival
- `colonization_raid` no-garrison — let a colonization tick without a defensive garrison
- `colonization_raid` combat — station ships on a colonizing planet and let a raid hit
- `abandon_return` homecoming — abandon a colony with a valid destination
- `abandon_return` lost — abandon a colony and delete the destination before arrival

For each, open the report from the `/reports` list and verify:
- Hero accent color matches spec (success/warning/danger/neutral)
- Lore line present only on dramatic outcomes
- `ResourceDeltaCard` hides when all amounts zero
- Raid "Voir le détail" toggle expands `CombatReportDetail` with rounds

If any report renders wrong, file notes and iterate on the specific component.

- [ ] **Step 3: Final typecheck sweep**

Run: `pnpm -F @exilium/web typecheck && pnpm -F @exilium/api typecheck`
Expected: both pass with no errors.
