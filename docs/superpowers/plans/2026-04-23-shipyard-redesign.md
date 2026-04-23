# Chantier spatial — redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre la page `Shipyard.tsx` (488 lignes) pour adopter le design language de `Market.tsx` (hero banner, KPI tiles, glass cards, filter chips par rôle), sans toucher à la logique métier ni aux endpoints tRPC.

**Architecture :** Décomposition de `Shipyard.tsx` en 8 sous-composants ciblés sous `components/shipyard/`, plus extraction du `KpiTile` interne de `Market.tsx` vers `components/common/` pour partage. La page racine devient un orchestrateur (~150 lignes) qui résout les queries tRPC, dérive les totaux, et passe des props aux feuilles. Pure refactor visuel : aucune mutation tRPC, route, ou règle de jeu n'est modifiée.

**Tech Stack :** React + React Router, TanStack Query, tRPC, Tailwind + `glass-card`, SVG inline.

**Spec :** `docs/superpowers/specs/2026-04-23-shipyard-redesign-design.md`.

**Deviation from spec :** Le champ `maxParallelSlots` n'est pas exposé par l'API (dérivé côté backend via talents). Pour éviter une modif API, les KPIs et le sous-titre du hero s'en tiennent aux valeurs dérivables côté front :
- Sous-titre hero : `Niveau {N}` uniquement (pas de " · X slots parallèles").
- KPI "Slots actifs" remplacé par "En cours" : nombre de batches actifs (sans max).

---

## File Structure

**Créations :**
```
apps/web/src/components/common/KpiTile.tsx          ← extrait de Market.tsx (partagé)
apps/web/src/components/shipyard/
  role-icons.tsx                                    ← SVGs pour Tout / Transport / Utilitaire
  ShipyardHero.tsx                                  ← bannière + thumb cliquable
  ShipyardKpis.tsx                                  ← 3 tuiles KPI
  ShipyardQueue.tsx                                 ← file de construction (glass-card)
  ShipyardRoleFilter.tsx                            ← chips Tout / Transport / Utilitaire
  ShipCard.tsx                                      ← carte desktop
  ShipMobileRow.tsx                                 ← ligne mobile
  ShipyardHelp.tsx                                  ← contenu de l'overlay d'aide
```

**Modifications :**
```
apps/web/src/pages/Market.tsx                       ← importe KpiTile depuis common/
apps/web/src/pages/Shipyard.tsx                     ← réécrit en orchestrateur
```

---

## Task ordering and dependencies

1. Extraction de `KpiTile` (tâche 1) : débloque sa réutilisation par Shipyard sans dupliquer le composant.
2. Icônes rôles (tâche 2) : utilisées par le filtre et les sous-sections.
3. Feuilles autonomes (tâches 3-9) : chaque composant reçoit ses props et peut être typecheck isolé.
4. Réécriture de `Shipyard.tsx` (tâche 10) : assemble le tout.
5. Vérification manuelle (tâche 11) : dev server + navigateur pour valider le rendu.

Chaque tâche se termine par `pnpm typecheck` + commit + push.

---

### Task 1: Extraire `KpiTile` de `Market.tsx` vers `components/common/`

Le composant `KpiTile` est aujourd'hui file-private dans `Market.tsx` (lignes ~58-82). On l'extrait pour qu'il soit réutilisable par Shipyard sans duplication. Comportement identique, `onClick` optionnel.

**Files:**
- Create: `apps/web/src/components/common/KpiTile.tsx`
- Modify: `apps/web/src/pages/Market.tsx`

- [ ] **Step 1: Créer le composant partagé**

Créer `apps/web/src/components/common/KpiTile.tsx` :

```typescript
import { cn } from '@/lib/utils';

interface KpiTileProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

export function KpiTile({ label, value, icon, color, onClick }: KpiTileProps) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border/30 bg-card/60 px-4 py-3 text-left transition-colors',
        interactive && 'hover:bg-card/80 hover:border-primary/20 cursor-pointer',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-white/5', color)}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className={cn('text-lg font-bold tabular-nums leading-tight', color)}>{value}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</div>
        </div>
      </div>
    </Tag>
  );
}
```

- [ ] **Step 2: Remplacer la définition privée dans `Market.tsx` par un import**

Dans `apps/web/src/pages/Market.tsx` :

1. Supprimer le commentaire `// ── KPI Tile ─────────────────────────────────────────────────────────` et la fonction `KpiTile` (lignes ~56-82 dans la version actuelle).
2. Ajouter dans le bloc d'imports en haut du fichier :

```typescript
import { KpiTile } from '@/components/common/KpiTile';
```

Les appels `<KpiTile ... />` existants n'ont pas besoin d'être modifiés.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur.

- [ ] **Step 4: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/common/KpiTile.tsx apps/web/src/pages/Market.tsx
git commit -m "refactor(ui): extract KpiTile to components/common for shared use"
git push
```

---

### Task 2: Icônes SVG pour les rôles (`role-icons.tsx`)

Trois icônes SVG inline pour le filtre rôle : grille (Tout), caisse-cargo (Transport), pioche (Utilitaire). Taille par défaut 14×14, `currentColor`.

**Files:**
- Create: `apps/web/src/components/shipyard/role-icons.tsx`

- [ ] **Step 1: Créer le module d'icônes**

Créer `apps/web/src/components/shipyard/role-icons.tsx` :

```typescript
interface IconProps {
  width?: number;
  height?: number;
  className?: string;
}

const defaults = { width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function RoleAllIcon({ width = 14, height = 14, className }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" {...defaults} className={className}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

export function RoleTransportIcon({ width = 14, height = 14, className }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" {...defaults} className={className}>
      <path d="M3 7h13v10H3z" />
      <path d="M16 10h4l1 3v4h-5z" />
      <circle cx="7" cy="18" r="1.5" />
      <circle cx="17" cy="18" r="1.5" />
    </svg>
  );
}

export function RoleUtilityIcon({ width = 14, height = 14, className }: IconProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" {...defaults} className={className}>
      <path d="M14 3c2 0 4 1 5 3-1 0-2 1-2 2s1 2 2 2c-1 2-3 3-5 3" />
      <path d="M14 13L4 21" />
      <path d="M4 21l-1-3 3 1" />
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur.

- [ ] **Step 3: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/shipyard/role-icons.tsx
git commit -m "feat(shipyard): role icons for filter chips"
git push
```

---

### Task 3: Composant `ShipyardHero`

Bannière haut de page : image de fond floutée + gradient, thumb circulaire cliquable à gauche, titre/sous-titre à droite, paragraphe descriptif en desktop. Click sur le thumb → `onOpenHelp()`.

**Files:**
- Create: `apps/web/src/components/shipyard/ShipyardHero.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
import { getAssetUrl } from '@/lib/assets';

interface ShipyardHeroProps {
  level: number;
  onOpenHelp: () => void;
}

export function ShipyardHero({ level, onOpenHelp }: ShipyardHeroProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={getAssetUrl('buildings', 'shipyard')}
          alt=""
          className="h-full w-full object-cover opacity-40 blur-sm scale-110"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/60 via-slate-950/80 to-purple-950/60" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

      <div className="relative px-5 pt-8 pb-6 lg:px-8 lg:pt-10 lg:pb-8">
        <div className="flex items-start gap-5">
          <button
            type="button"
            onClick={onOpenHelp}
            className="relative group shrink-0"
            title="Comment fonctionne le chantier spatial ?"
          >
            <img
              src={getAssetUrl('buildings', 'shipyard', 'thumb')}
              alt="Chantier spatial"
              className="h-20 w-20 lg:h-24 lg:w-24 rounded-full border-2 border-primary/30 object-cover shadow-lg shadow-cyan-500/10 transition-opacity group-hover:opacity-80"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </div>
          </button>

          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">Chantier spatial</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Niveau {level}</p>
            <p className="text-xs text-muted-foreground/70 mt-2 max-w-lg leading-relaxed hidden lg:block">
              Assemblez les vaisseaux industriels de votre empire : transporteurs, prospecteurs, récupérateurs.
              Chaque niveau du chantier débloque un slot de production parallèle supplémentaire.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur.

- [ ] **Step 3: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/shipyard/ShipyardHero.tsx
git commit -m "feat(shipyard): hero banner with clickable building thumb"
git push
```

---

### Task 4: Composant `ShipyardKpis`

Trois tuiles KPI : Vaisseaux stationnés (cyan), En construction (amber), En cours (emerald).

**Files:**
- Create: `apps/web/src/components/shipyard/ShipyardKpis.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
import { KpiTile } from '@/components/common/KpiTile';

interface ShipyardKpisProps {
  stationedCount: number;
  buildingCount: number;
  activeBatches: number;
}

export function ShipyardKpis({ stationedCount, buildingCount, activeBatches }: ShipyardKpisProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <KpiTile
        label="Vaisseaux stationnés"
        value={stationedCount.toLocaleString('fr-FR')}
        color="text-cyan-400"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 12l10 10 10-10z" />
          </svg>
        }
      />
      <KpiTile
        label="En construction"
        value={buildingCount}
        color="text-amber-400"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
          </svg>
        }
      />
      <KpiTile
        label="En cours"
        value={activeBatches}
        color="text-emerald-400"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur.

- [ ] **Step 3: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/shipyard/ShipyardKpis.tsx
git commit -m "feat(shipyard): KPI tiles (stationed, building, active)"
git push
```

---

### Task 5: Composant `ShipyardQueue`

File de construction en glass-card. Logique de calcul de la fin de file, badge parallèle, rangée active/queued, boutons -1 et Annuler. Entrée `shipQueue` + callbacks.

**Files:**
- Create: `apps/web/src/components/shipyard/ShipyardQueue.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
import { Button } from '@/components/ui/button';
import { Timer } from '@/components/common/Timer';
import { cn } from '@/lib/utils';
import { getShipName } from '@/lib/entity-names';
import type { GameConfig } from '@/hooks/useGameConfig';

type QueueEntry = {
  id: string;
  itemId: string;
  status: 'active' | 'queued' | string;
  quantity: number;
  completedCount?: number | null;
  startTime: string | Date;
  endTime?: string | Date | null;
};

type ShipRef = { id: string; timePerUnit: number };

interface ShipyardQueueProps {
  queue: QueueEntry[];
  ships: ShipRef[];
  gameConfig: GameConfig | undefined;
  onTimerComplete: () => void;
  onReduce: (batchId: string) => void;
  onCancel: (batchId: string) => void;
  reducePending: boolean;
  cancelPending: boolean;
}

export function ShipyardQueue({
  queue,
  ships,
  gameConfig,
  onTimerComplete,
  onReduce,
  onCancel,
  reducePending,
  cancelPending,
}: ShipyardQueueProps) {
  if (queue.length === 0) return null;

  const activeEntries = queue.filter((e) => e.status === 'active');
  const parallelSlots = activeEntries.length;

  let queueEndTime: Date | null = null;
  let totalMs = 0;
  const queuedItems = queue.filter((e) => e.status === 'queued');
  const totalQueuedUnits = queuedItems.reduce((sum, e) => sum + (e.quantity - (e.completedCount ?? 0)), 0);
  let longestActiveMs = 0;
  for (const item of activeEntries) {
    const remaining = item.quantity - (item.completedCount ?? 0);
    if (item.endTime) {
      const unitDurationMs = new Date(item.endTime).getTime() - new Date(item.startTime).getTime();
      const itemMs = (new Date(item.endTime).getTime() - Date.now()) + unitDurationMs * (remaining - 1);
      if (itemMs > longestActiveMs) longestActiveMs = itemMs;
    }
  }
  totalMs = longestActiveMs;
  if (totalQueuedUnits > 0 && parallelSlots > 0) {
    const sampleShip = ships.find((s) => s.id === queuedItems[0]?.itemId);
    if (sampleShip) {
      totalMs += Math.ceil(totalQueuedUnits / Math.max(1, parallelSlots)) * sampleShip.timePerUnit * 1000;
    }
  }
  if (totalMs > 0) queueEndTime = new Date(Date.now() + totalMs);

  return (
    <section className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <h2 className="text-base font-semibold">File de construction</h2>
          {parallelSlots > 1 && (
            <span className="rounded bg-cyan-500/20 border border-cyan-500/50 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
              x{parallelSlots} parallele
            </span>
          )}
        </div>
        {queueEndTime && (
          <span className="text-xs text-muted-foreground">
            Fin : {queueEndTime.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {queue.map((item) => {
          const name = getShipName(item.itemId, gameConfig);
          const remaining = item.quantity - (item.completedCount ?? 0);
          return (
            <div
              key={item.id}
              className={cn(
                'space-y-1 border-l-4 pl-3',
                item.status === 'active' ? 'border-l-orange-500' : 'border-l-muted-foreground/30',
              )}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {remaining}x {name}
                  {item.status === 'active' && parallelSlots > 1 && (
                    <span className="ml-1.5 text-[10px] text-orange-400 font-normal">(slot actif)</span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  {remaining > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => onReduce(item.id)}
                      disabled={reducePending}
                    >
                      -1
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => onCancel(item.id)}
                    disabled={cancelPending}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
              {item.status === 'active' && item.endTime && (
                <Timer
                  endTime={new Date(item.endTime)}
                  totalDuration={Math.floor((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 1000)}
                  onComplete={onTimerComplete}
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
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur. Si `GameConfig` n'est pas exporté comme type, remplacer par `ReturnType<typeof useGameConfig>['data']` (ou l'équivalent). Vérifier dans `apps/web/src/hooks/useGameConfig.ts`.

- [ ] **Step 3: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/shipyard/ShipyardQueue.tsx
git commit -m "feat(shipyard): construction queue glass-card"
git push
```

---

### Task 6: Composant `ShipyardRoleFilter`

Trois chips (Tout / Transport / Utilitaire) avec leur icône. État contrôlé par le parent.

**Files:**
- Create: `apps/web/src/components/shipyard/ShipyardRoleFilter.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
import { cn } from '@/lib/utils';
import { RoleAllIcon, RoleTransportIcon, RoleUtilityIcon } from './role-icons';

export type ShipyardFilter = 'all' | 'ship_transport' | 'ship_utilitaire';

interface ShipyardRoleFilterProps {
  value: ShipyardFilter;
  onChange: (value: ShipyardFilter) => void;
}

const FILTERS: { key: ShipyardFilter; label: string; Icon: (p: { className?: string }) => JSX.Element }[] = [
  { key: 'all', label: 'Tout', Icon: RoleAllIcon },
  { key: 'ship_transport', label: 'Transport', Icon: RoleTransportIcon },
  { key: 'ship_utilitaire', label: 'Utilitaire', Icon: RoleUtilityIcon },
];

export function ShipyardRoleFilter({ value, onChange }: ShipyardRoleFilterProps) {
  return (
    <div className="flex gap-0.5 bg-card/30 rounded-lg p-0.5 border border-border/20 w-fit">
      {FILTERS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5',
            value === key
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur.

- [ ] **Step 3: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/shipyard/ShipyardRoleFilter.tsx
git commit -m "feat(shipyard): role filter chips with SVG icons"
git push
```

---

### Task 7: Composant `ShipCard` (desktop)

Carte desktop : image 130px, badge x{count}, nom, coût, durée, `QuantityStepper` + `Construire` (ou `PrerequisiteList` si verrouillée). Click-hors-contrôles ouvre l'overlay détail.

**Files:**
- Create: `apps/web/src/components/shipyard/ShipCard.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
import { Button } from '@/components/ui/button';
import { ResourceCost } from '@/components/common/ResourceCost';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { GameImage } from '@/components/common/GameImage';
import { PrerequisiteList, buildPrerequisiteItems } from '@/components/common/PrerequisiteList';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GameConfig } from '@/hooks/useGameConfig';

type Ship = {
  id: string;
  name: string;
  count: number;
  timePerUnit: number;
  cost: { minerai: number; silicium: number; hydrogene: number };
  prerequisitesMet: boolean;
};

interface ShipCardProps {
  ship: Ship;
  quantity: number;
  maxAffordable: number;
  canAfford: boolean;
  highlighted: boolean;
  resources: { minerai: number; silicium: number; hydrogene: number };
  gameConfig: GameConfig | undefined;
  buildingLevels: Record<string, number>;
  researchLevels: Record<string, number>;
  buildPending: boolean;
  onQuantityChange: (value: number) => void;
  onBuild: () => void;
  onOpenDetail: () => void;
}

export function ShipCard({
  ship,
  quantity,
  maxAffordable,
  canAfford,
  highlighted,
  resources,
  gameConfig,
  buildingLevels,
  researchLevels,
  buildPending,
  onQuantityChange,
  onBuild,
  onOpenDetail,
}: ShipCardProps) {
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className={cn(
        'retro-card relative text-left cursor-pointer overflow-hidden flex flex-col',
        !ship.prerequisitesMet && 'opacity-50',
        highlighted && 'ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/10',
      )}
    >
      {highlighted && (
        <span className="absolute top-2 right-2 z-10 rounded bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
          Objectif
        </span>
      )}
      <div className="relative h-[130px] overflow-hidden">
        <GameImage category="ships" id={ship.id} size="full" alt={ship.name} className="w-full h-full object-cover" />
        <span className="absolute top-2 right-2 bg-slate-700/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
          x{ship.count}
        </span>
      </div>

      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <div className="text-[13px] font-semibold text-foreground truncate">{ship.name}</div>
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
          <PrerequisiteList
            items={buildPrerequisiteItems(gameConfig?.ships[ship.id]?.prerequisites ?? {}, buildingLevels, researchLevels, gameConfig)}
            missingOnly
          />
        ) : (
          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
            <QuantityStepper value={quantity} onChange={onQuantityChange} max={maxAffordable} />
            <Button
              variant="retro"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onBuild();
              }}
              disabled={!canAfford || buildPending}
            >
              Construire
            </Button>
          </div>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur. Si `GameConfig` pose problème, remplacer par `any` type pour les props dérivées — la forme vient de `useGameConfig`. Vérifier les exports dans `apps/web/src/hooks/useGameConfig.ts`.

- [ ] **Step 3: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/shipyard/ShipCard.tsx
git commit -m "feat(shipyard): ShipCard desktop component"
git push
```

---

### Task 8: Composant `ShipMobileRow`

Ligne mobile compacte : thumb 32×32, nom, compteur, coût, durée, stepper + OK inline si débloqué.

**Files:**
- Create: `apps/web/src/components/shipyard/ShipMobileRow.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
import { Button } from '@/components/ui/button';
import { ResourceCost } from '@/components/common/ResourceCost';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { GameImage } from '@/components/common/GameImage';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

type Ship = {
  id: string;
  name: string;
  count: number;
  timePerUnit: number;
  cost: { minerai: number; silicium: number; hydrogene: number };
  prerequisitesMet: boolean;
};

interface ShipMobileRowProps {
  ship: Ship;
  quantity: number;
  maxAffordable: number;
  canAfford: boolean;
  highlighted: boolean;
  buildPending: boolean;
  onQuantityChange: (value: number) => void;
  onBuild: () => void;
  onOpenDetail: () => void;
}

export function ShipMobileRow({
  ship,
  quantity,
  maxAffordable,
  canAfford,
  highlighted,
  buildPending,
  onQuantityChange,
  onBuild,
  onOpenDetail,
}: ShipMobileRowProps) {
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className={cn(
        'relative flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent/50 transition-colors',
        !ship.prerequisitesMet && 'opacity-50',
        highlighted && 'ring-2 ring-amber-500/60 shadow-lg shadow-amber-500/10',
      )}
    >
      {highlighted && (
        <span className="absolute top-2 right-2 z-10 rounded bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-400">
          Objectif
        </span>
      )}
      <GameImage category="ships" id={ship.id} size="icon" alt={ship.name} className="h-8 w-8 rounded" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{ship.name}</span>
          <span className="text-xs text-muted-foreground">x{ship.count}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <ResourceCost minerai={ship.cost.minerai} silicium={ship.cost.silicium} hydrogene={ship.cost.hydrogene} />
          <span className="font-mono text-[10px] shrink-0">{formatDuration(ship.timePerUnit)}</span>
        </div>
      </div>
      {ship.prerequisitesMet && (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <QuantityStepper value={quantity} onChange={onQuantityChange} max={maxAffordable} showMax={false} />
          <Button
            size="sm"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onBuild();
            }}
            disabled={!canAfford || buildPending}
          >
            OK
          </Button>
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur.

- [ ] **Step 3: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/shipyard/ShipMobileRow.tsx
git commit -m "feat(shipyard): ShipMobileRow compact mobile list row"
git push
```

---

### Task 9: Composant `ShipyardHelp` (contenu de l'overlay)

Contenu rendu à l'intérieur de `EntityDetailOverlay` : hero image + sections catégories / slots / file / annulation.

**Files:**
- Create: `apps/web/src/components/shipyard/ShipyardHelp.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
import { getAssetUrl } from '@/lib/assets';

interface ShipyardHelpProps {
  level: number;
}

export function ShipyardHelp({ level }: ShipyardHelpProps) {
  return (
    <>
      <div className="relative -mx-5 -mt-5 overflow-hidden rounded-t-lg">
        <img
          src={getAssetUrl('buildings', 'shipyard')}
          alt=""
          className="w-full h-40 object-cover"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        <div className="absolute bottom-3 left-5">
          <p className="text-sm font-semibold text-foreground">Niveau {level}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Catégories
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Le chantier assemble les vaisseaux <span className="text-foreground font-medium">transport</span> (petit, grand, colonisateur)
          et <span className="text-foreground font-medium">utilitaires</span> (prospecteurs, récupérateurs).
          Les vaisseaux de combat sont construits au Centre de commandement.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6" />
          </svg>
          Slots parallèles
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Chaque niveau du chantier et certains talents industriels débloquent un <span className="text-foreground font-medium">slot de production supplémentaire</span>,
          permettant d'assembler plusieurs vaisseaux simultanément.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          File d'attente
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Les vaisseaux en surplus des slots actifs sont <span className="text-foreground font-medium">mis en file</span> et démarrent dès qu'un slot se libère.
          Utilisez <span className="text-foreground font-medium">-1</span> pour retirer une unité d'un lot, ou <span className="text-foreground font-medium">Annuler</span> pour tout arrêter.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          Annulation
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Annuler un lot rembourse les ressources au <span className="text-foreground font-medium">prorata du temps restant</span>, plafonné à <span className="text-foreground font-medium">70&nbsp;%</span>.
          Les vaisseaux déjà produits sont conservés dans votre hangar.
        </p>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur.

- [ ] **Step 3: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/components/shipyard/ShipyardHelp.tsx
git commit -m "feat(shipyard): help overlay content"
git push
```

---

### Task 10: Réécrire `Shipyard.tsx` en orchestrateur

Remplacer l'intégralité du fichier `apps/web/src/pages/Shipyard.tsx`. Garder toutes les queries, mutations, états locaux, logique de prix, et l'overlay détail. Remplacer uniquement le JSX de rendu par la composition des nouveaux composants.

**Files:**
- Modify: `apps/web/src/pages/Shipyard.tsx`

- [ ] **Step 1: Réécrire le fichier**

Remplacer intégralement le contenu de `apps/web/src/pages/Shipyard.tsx` par :

```typescript
import { useState, useMemo, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useTutorialTargetId } from '@/hooks/useTutorialHighlight';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { EntityDetailOverlay } from '@/components/common/EntityDetailOverlay';
import { ShipDetailContent } from '@/components/entity-details/ShipDetailContent';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ShipyardHero } from '@/components/shipyard/ShipyardHero';
import { ShipyardKpis } from '@/components/shipyard/ShipyardKpis';
import { ShipyardQueue } from '@/components/shipyard/ShipyardQueue';
import { ShipyardRoleFilter, type ShipyardFilter } from '@/components/shipyard/ShipyardRoleFilter';
import { ShipCard } from '@/components/shipyard/ShipCard';
import { ShipMobileRow } from '@/components/shipyard/ShipMobileRow';
import { ShipyardHelp } from '@/components/shipyard/ShipyardHelp';
import { RoleAllIcon, RoleTransportIcon, RoleUtilityIcon } from '@/components/shipyard/role-icons';

const CATEGORY_ICON: Record<string, (p: { className?: string }) => JSX.Element> = {
  ship_transport: RoleTransportIcon,
  ship_utilitaire: RoleUtilityIcon,
};

export default function Shipyard() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const utils = trpc.useUtils();
  const { data: gameConfig } = useGameConfig();
  const tutorialTargetId = useTutorialTargetId();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  useEffect(() => { setQuantities({}); }, [planetId]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [filter, setFilter] = useState<ShipyardFilter>('all');

  const shipCategories = (gameConfig?.categories ?? [])
    .filter((c) => c.entityType === 'ship' && c.id !== 'ship_combat')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const { data: buildings } = trpc.building.list.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );
  const shipyardLevel = buildings?.find((b) => b.id === 'shipyard')?.currentLevel ?? 0;

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
    { planetId: planetId!, facilityId: 'shipyard' },
    { enabled: !!planetId },
  );

  const { data: researchData } = trpc.research.list.useQuery();
  const researchList = researchData?.items;

  const researchLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    researchList?.forEach((r) => { levels[r.id] = r.currentLevel; });
    return levels;
  }, [researchList]);

  const buildingLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    buildings?.forEach((b) => { levels[b.id] = b.currentLevel; });
    return levels;
  }, [buildings]);

  const buildMutation = trpc.shipyard.buildShip.useMutation({
    onSuccess: () => {
      utils.shipyard.ships.invalidate({ planetId: planetId! });
      utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'shipyard' });
      utils.resource.production.invalidate({ planetId: planetId! });
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
    },
  });

  const cancelMutation = trpc.shipyard.cancelBatch.useMutation({
    onSuccess: () => {
      utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'shipyard' });
      utils.shipyard.ships.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
      setCancelConfirm(null);
    },
  });

  const reduceMutation = trpc.shipyard.reduceQuantity.useMutation({
    onSuccess: () => {
      utils.shipyard.queue.invalidate();
      utils.shipyard.ships.invalidate();
      utils.shipyard.defenses.invalidate();
      utils.resource.production.invalidate();
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
    },
  });

  const shipQueue = queue ?? [];

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading || !ships) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Chantier spatial" />
        <CardGridSkeleton count={6} />
      </div>
    );
  }

  // ── Locked (shipyard not built) ───────────────────────────────────────
  if (buildings && shipyardLevel < 1) {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/80 via-slate-950 to-purple-950/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="relative flex flex-col items-center justify-center px-5 py-16 lg:py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-muted-foreground/20 bg-card/50 mb-6">
              <svg className="h-10 w-10 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Chantier spatial</h1>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Construisez le <span className="text-foreground font-semibold">Chantier spatial</span> pour assembler les vaisseaux industriels de votre empire.
            </p>
            <Link
              to="/buildings"
              className="inline-flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/30 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Aller aux bâtiments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Derived totals for KPIs ───────────────────────────────────────────
  const stationedCount = ships.reduce((sum, s) => sum + (s.count ?? 0), 0);
  const buildingCount = shipQueue.reduce((sum, e) => sum + (e.quantity - (e.completedCount ?? 0)), 0);
  const activeBatches = shipQueue.filter((e) => e.status === 'active').length;

  // ── Visible categories based on filter ────────────────────────────────
  const visibleCategories = filter === 'all' ? shipCategories : shipCategories.filter((c) => c.id === filter);

  // ── Main layout ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ShipyardHero level={shipyardLevel} onOpenHelp={() => setHelpOpen(true)} />

      <div className="space-y-4 px-4 pb-4 lg:px-6 lg:pb-6">
        <ShipyardKpis
          stationedCount={stationedCount}
          buildingCount={buildingCount}
          activeBatches={activeBatches}
        />

        <ShipyardQueue
          queue={shipQueue}
          ships={ships}
          gameConfig={gameConfig}
          onTimerComplete={() => {
            utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'shipyard' });
            utils.shipyard.ships.invalidate({ planetId: planetId! });
          }}
          onReduce={(batchId) => reduceMutation.mutate({ planetId: planetId!, batchId, removeCount: 1 })}
          onCancel={(batchId) => setCancelConfirm(batchId)}
          reducePending={reduceMutation.isPending}
          cancelPending={cancelMutation.isPending}
        />

        <ShipyardRoleFilter value={filter} onChange={setFilter} />

        <section className="glass-card p-4 lg:p-5 space-y-8">
          {visibleCategories.map((category) => {
            const categoryShips = ships.filter((s) => gameConfig?.ships[s.id]?.categoryId === category.id);
            if (categoryShips.length === 0) return null;
            const CategoryIcon = CATEGORY_ICON[category.id] ?? RoleAllIcon;

            return (
              <div key={category.id}>
                {filter === 'all' && (
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    <CategoryIcon className="h-3.5 w-3.5" />
                    {category.name}
                  </h3>
                )}

                {/* Mobile compact list */}
                <div className="space-y-1 lg:hidden">
                  {categoryShips.map((ship) => {
                    const qty = quantities[ship.id] || 1;
                    const maxAffordable = Math.max(1, Math.min(
                      ship.cost.minerai > 0 ? Math.floor(resources.minerai / ship.cost.minerai) : 9999,
                      ship.cost.silicium > 0 ? Math.floor(resources.silicium / ship.cost.silicium) : 9999,
                      ship.cost.hydrogene > 0 ? Math.floor(resources.hydrogene / ship.cost.hydrogene) : 9999,
                      9999,
                    ));
                    const totalCost = {
                      minerai: ship.cost.minerai * qty,
                      silicium: ship.cost.silicium * qty,
                      hydrogene: ship.cost.hydrogene * qty,
                    };
                    const canAfford =
                      resources.minerai >= totalCost.minerai &&
                      resources.silicium >= totalCost.silicium &&
                      resources.hydrogene >= totalCost.hydrogene;
                    const highlighted = tutorialTargetId === ship.id;

                    return (
                      <ShipMobileRow
                        key={ship.id}
                        ship={ship}
                        quantity={qty}
                        maxAffordable={maxAffordable}
                        canAfford={canAfford}
                        highlighted={highlighted}
                        buildPending={buildMutation.isPending}
                        onQuantityChange={(v) => setQuantities({ ...quantities, [ship.id]: v })}
                        onBuild={() => buildMutation.mutate({ planetId: planetId!, shipId: ship.id as any, quantity: qty })}
                        onOpenDetail={() => setDetailId(ship.id)}
                      />
                    );
                  })}
                </div>

                {/* Desktop vertical card grid */}
                <div className="hidden lg:grid lg:gap-4 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                  {categoryShips.map((ship) => {
                    const qty = quantities[ship.id] || 1;
                    const maxAffordable = Math.max(1, Math.min(
                      ship.cost.minerai > 0 ? Math.floor(resources.minerai / ship.cost.minerai) : 9999,
                      ship.cost.silicium > 0 ? Math.floor(resources.silicium / ship.cost.silicium) : 9999,
                      ship.cost.hydrogene > 0 ? Math.floor(resources.hydrogene / ship.cost.hydrogene) : 9999,
                      9999,
                    ));
                    const totalCost = {
                      minerai: ship.cost.minerai * qty,
                      silicium: ship.cost.silicium * qty,
                      hydrogene: ship.cost.hydrogene * qty,
                    };
                    const canAfford =
                      resources.minerai >= totalCost.minerai &&
                      resources.silicium >= totalCost.silicium &&
                      resources.hydrogene >= totalCost.hydrogene;
                    const highlighted = tutorialTargetId === ship.id;

                    return (
                      <ShipCard
                        key={ship.id}
                        ship={ship}
                        quantity={qty}
                        maxAffordable={maxAffordable}
                        canAfford={canAfford}
                        highlighted={highlighted}
                        resources={{ minerai: resources.minerai, silicium: resources.silicium, hydrogene: resources.hydrogene }}
                        gameConfig={gameConfig}
                        buildingLevels={buildingLevels}
                        researchLevels={researchLevels}
                        buildPending={buildMutation.isPending}
                        onQuantityChange={(v) => setQuantities({ ...quantities, [ship.id]: v })}
                        onBuild={() => buildMutation.mutate({ planetId: planetId!, shipId: ship.id as any, quantity: qty })}
                        onOpenDetail={() => setDetailId(ship.id)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* Detail overlay */}
      <EntityDetailOverlay
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detailId ? gameConfig?.ships[detailId]?.name ?? '' : ''}
      >
        {detailId && (
          <ShipDetailContent
            shipId={detailId}
            researchLevels={researchLevels}
            buildingLevels={buildingLevels}
            maxTemp={resourceData?.maxTemp}
            isHomePlanet={resourceData?.planetClassId === 'homeworld'}
            timePerUnit={ships?.find((s) => s.id === detailId)?.timePerUnit}
          />
        )}
      </EntityDetailOverlay>

      {/* Help overlay */}
      <EntityDetailOverlay open={helpOpen} onClose={() => setHelpOpen(false)} title="Chantier spatial">
        <ShipyardHelp level={shipyardLevel} />
      </EntityDetailOverlay>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!cancelConfirm}
        onConfirm={() => cancelConfirm && cancelMutation.mutate({ planetId: planetId!, batchId: cancelConfirm })}
        onCancel={() => setCancelConfirm(null)}
        title="Annuler la production ?"
        description="Les unités restantes seront annulées. Le remboursement est proportionnel au temps restant, plafonné à 70% des ressources investies. Les unités déjà produites sont conservées."
        confirmLabel="Annuler la production"
        variant="destructive"
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm typecheck
```

Attendu : pas d'erreur. Si `gameConfig` typé `unknown` casse les props, aligner le typage en mettant `gameConfig: any` dans les composants enfants — la forme réelle vient du hook existant.

- [ ] **Step 3: Lint (facultatif mais rapide)**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium/apps/web && pnpm lint
```

Attendu : pas d'erreur sur les fichiers touchés.

- [ ] **Step 4: Commit**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src/pages/Shipyard.tsx
git commit -m "feat(shipyard): adopt Market design language (hero, KPIs, role filter)"
git push
```

---

### Task 11: Vérification manuelle end-to-end

Smoke test dans le navigateur : chaque comportement existant doit fonctionner et l'esthétique doit matcher Market.

**Files:** aucun.

- [ ] **Step 1: Lancer le dev server**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium && pnpm dev
```

Attendre que `apps/web` soit dispo (port par défaut).

- [ ] **Step 2: Checklist visuelle et fonctionnelle**

Naviguer vers `/shipyard` (sur une planète où le chantier est construit) et vérifier :

1. **Hero** : image de fond floutée + thumb circulaire du chantier. Click sur le thumb → overlay d'aide s'ouvre avec les 4 sections.
2. **KPIs** : trois tuiles (vaisseaux stationnés, en construction, en cours). Valeurs cohérentes avec la file/les counts.
3. **File** : affichée seulement si au moins un batch en cours. Badge `xN parallele` si ≥ 2 actifs. Bouton `-1` réduit la qty, `Annuler` ouvre le ConfirmDialog. Timer décompte correctement.
4. **Filtre rôle** : `Tout` / `Transport` / `Utilitaire` avec leurs icônes. Sélectionner chacun ; le contenu change sans rechargement.
5. **Cartes ships (desktop)** : image, badge count, coût (rouge si insuffisant), durée, stepper, bouton Construire. Tutorial highlight visible si objectif actif.
6. **Mobile** : ouvrir en viewport mobile (devtools). Les rangées compactes affichent stepper + OK inline.
7. **Click sur une carte** (hors contrôles) : `EntityDetailOverlay` s'ouvre avec les détails du vaisseau.
8. **Prérequis non remplis** : carte à 50 % opacity, `PrerequisiteList` en bas au lieu des contrôles.
9. **État verrouillé** : tester sur une planète où le chantier n'est pas construit ou via un debug — doit afficher l'état verrouillé type Market.

- [ ] **Step 3: Fixer d'éventuelles régressions**

Si un comportement diffère, corriger dans le composant concerné, typecheck, commit+push, puis refaire le tour.

- [ ] **Step 4: Commit final (si corrections)**

```bash
cd /Users/julienaubree/_projet/exilium-game/exilium
git add apps/web/src
git commit -m "fix(shipyard): QA adjustments after manual verification"
git push
```

Si aucune régression : aucun commit nécessaire.

---

## Self-review notes

- **Spec coverage :** hero (tâche 3), KPIs (tâche 4), queue (tâche 5), filtre rôle (tâche 6), cartes + mobile (tâches 7-8), help overlay (tâche 9), locked state + orchestration (tâche 10), vérif fonctionnelle (tâche 11). Extraction `KpiTile` (tâche 1) + icônes (tâche 2) en prérequis.
- **Deviation déclarée :** `maxParallelSlots` pas exposé par l'API → sous-titre hero simplifié à "Niveau {N}", KPI "Slots actifs" remplacé par "En cours" (compte de batches actifs). Pas de modif backend.
- **Types :** les composants enfants typent `gameConfig` comme `GameConfig | undefined` (import depuis `@/hooks/useGameConfig`) ; si le type n'est pas exporté, replier sur `any` (forme identique à l'usage actuel dans `Shipyard.tsx`).
- **Pas de règle de jeu modifiée :** toutes les mutations tRPC et leurs invalidations sont recopiées verbatim depuis le fichier actuel.
