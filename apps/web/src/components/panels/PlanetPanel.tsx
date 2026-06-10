import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, ArrowUp, Hammer, FlaskConical, ShieldPlus, X } from 'lucide-react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';
import { getPlanetImageUrl } from '@/lib/assets';
import { usePlanetStore } from '@/stores/planet.store';
import { usePanelStore } from '@/stores/panel.store';
import { PanelWindow } from './PanelWindow';
import { Timer } from '@/components/common/Timer';
import { useGameConfig } from '@/hooks/useGameConfig';
import { getBuildingName, getResearchName, getShipName, getDefenseName } from '@/lib/entity-names';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from '@/components/common/ResourceIcons';
import { OverviewIcon, ShipyardIcon } from '@/lib/icons';
import { ImportResourcesButton } from '@/components/resources/ImportResourcesButton';

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.floor(value));
}

/**
 * Panneau Planète (Passerelle P2) : la planète active en fenêtre, ouverte
 * depuis le dock ou la touche P — identité, ressources, activité, accès
 * direct aux onglets du drill-down.
 */
export function PlanetPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'apercu' | 'construire'>('apercu');
  const close = usePanelStore((s) => s.close);
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);
  const { data: gameConfig } = useGameConfig();
  const { data: empire } = trpc.planet.empire.useQuery(undefined, { refetchInterval: 60_000 });

  const planet =
    empire?.planets.find((p) => p.id === activePlanetId) ?? empire?.planets[0];

  const go = (path: string) => {
    close('planete');
    navigate(path, { viewTransition: true });
  };

  if (!planet) {
    return (
      <PanelWindow title="Planète" side="left" shortcut="P" onClose={() => close('planete')}>
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Chargement…
        </div>
      </PanelWindow>
    );
  }

  const resources = [
    { label: 'Minerai', icon: <MineraiIcon size={13} />, value: planet.minerai, max: planet.storageMineraiCapacity ?? 0, rate: planet.mineraiPerHour ?? 0, color: 'text-minerai', fill: 'bg-minerai' },
    { label: 'Silicium', icon: <SiliciumIcon size={13} />, value: planet.silicium, max: planet.storageSiliciumCapacity ?? 0, rate: planet.siliciumPerHour ?? 0, color: 'text-silicium', fill: 'bg-silicium' },
    { label: 'Hydrogène', icon: <HydrogeneIcon size={13} />, value: planet.hydrogene, max: planet.storageHydrogeneCapacity ?? 0, rate: planet.hydrogenePerHour ?? 0, color: 'text-hydrogene', fill: 'bg-hydrogene' },
  ];

  const activities: { key: string; icon: React.ReactNode; label: string; endTime: string; to: string }[] = [];
  if (planet.activeBuild) {
    activities.push({
      key: 'build',
      icon: <Hammer className="h-3.5 w-3.5" />,
      label: `${getBuildingName(planet.activeBuild.buildingId, gameConfig)} Nv.${planet.activeBuild.level}`,
      endTime: planet.activeBuild.endTime,
      to: `/planet/${planet.id}/resources`,
    });
  }
  if (planet.activeResearch) {
    activities.push({
      key: 'research',
      icon: <FlaskConical className="h-3.5 w-3.5" />,
      label: getResearchName(planet.activeResearch.researchId, gameConfig),
      endTime: planet.activeResearch.endTime,
      to: '/research',
    });
  }
  if (planet.activeShipyard) {
    activities.push({
      key: 'shipyard',
      icon: <ShipyardIcon width={14} height={14} />,
      label: `${getShipName(planet.activeShipyard.shipId, gameConfig)} ×${planet.activeShipyard.quantity}`,
      endTime: planet.activeShipyard.endTime,
      to: `/planet/${planet.id}/production`,
    });
  }
  if (planet.activeDefense) {
    activities.push({
      key: 'defense',
      icon: <ShieldPlus className="h-3.5 w-3.5" />,
      label: `${getDefenseName(planet.activeDefense.defenseId, gameConfig)} ×${planet.activeDefense.quantity}`,
      endTime: planet.activeDefense.endTime,
      to: `/planet/${planet.id}/production?tab=defenses`,
    });
  }

  return (
    <PanelWindow
      title={planet.name}
      icon={<OverviewIcon width={16} height={16} className="text-primary" />}
      side="left"
      shortcut="P"
      onClose={() => close('planete')}
    >
      <div className="space-y-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {([['apercu', 'Aperçu'], ['construire', 'Construire']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-fast',
                tab === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'construire' ? (
          <BuildTab planet={planet} onNavigate={go} />
        ) : (
        <>
        {/* Bannière — même langage que les cartes du home */}
        <button
          type="button"
          onClick={() => go(`/planet/${planet.id}`)}
          className="relative block h-24 w-full overflow-hidden rounded-lg text-left group"
        >
          {planet.planetClassId && planet.planetImageIndex != null ? (
            <img
              src={getPlanetImageUrl(planet.planetClassId, planet.planetImageIndex, 'thumb')}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-slow group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-secondary" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-raised via-surface-raised/30 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3">
            <span className="block text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {planet.name}
            </span>
            <span className="block text-xs tabular-nums text-muted-foreground">
              [{planet.galaxy}:{planet.system}:{planet.position}] · {planet.diameter.toLocaleString('fr-FR')} km
            </span>
          </div>
        </button>

        {/* Ressources */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Ressources</span>
            <ImportResourcesButton targetPlanetId={planet.id} size="sm" />
          </div>
          {resources.map((r) => {
            const pct = r.max > 0 ? Math.min(100, (r.value / r.max) * 100) : 0;
            const isFull = pct > 95;
            return (
              <div key={r.label} title={`${r.label} : ${r.value.toLocaleString('fr-FR')} / ${r.max.toLocaleString('fr-FR')}`}>
                <div className="flex items-center justify-between tabular-nums">
                  <span className={cn('flex items-center gap-1.5 text-xs font-semibold', r.color)}>
                    {r.icon}
                    {formatCompact(r.value)}
                    {isFull && <span className="text-xs font-normal text-amber-400/80">· plein</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">+{formatCompact(r.rate)}/h</span>
                </div>
                <div className="mt-0.5 h-[4px] overflow-hidden rounded-full bg-secondary">
                  <div className={cn('h-full rounded-full', r.fill)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Activité */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Activité</span>
          {activities.length > 0 ? (
            <ul className="space-y-1.5">
              {activities.map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    onClick={() => go(a.to)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-muted-foreground transition-colors duration-fast hover:border-border-strong hover:text-foreground"
                  >
                    {a.icon}
                    <span className="min-w-0 flex-1 truncate">{a.label}</span>
                    <Timer endTime={new Date(a.endTime)} className="shrink-0 tabular-nums [&>span]:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">
              Files au repos — lancer une construction ?
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => go(`/planet/${planet.id}`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors duration-fast hover:bg-primary/90"
          >
            Ouvrir la planète
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => go(`/planet/${planet.id}/production`)}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
          >
            Production
          </button>
        </div>
        </>
        )}
      </div>
    </PanelWindow>
  );
}

/**
 * Onglet Construire : la file de bâtiments pilotable depuis le panneau —
 * lancer/annuler une amélioration sans quitter l'écran courant.
 * Même optimistic UI que la page (M4) : la file démarre instantanément.
 */
function BuildTab({ planet, onNavigate }: {
  planet: { id: string; minerai: number; silicium: number; hydrogene: number };
  onNavigate: (path: string) => void;
}) {
  const utils = trpc.useUtils();
  const { data: buildings } = trpc.building.list.useQuery({ planetId: planet.id });

  const invalidate = () => {
    utils.building.list.invalidate({ planetId: planet.id });
    utils.planet.empire.invalidate();
    utils.resource.production.invalidate({ planetId: planet.id });
  };

  const upgradeMutation = trpc.building.upgrade.useMutation({
    onMutate: async (vars) => {
      await utils.building.list.cancel({ planetId: planet.id });
      const previous = utils.building.list.getData({ planetId: planet.id });
      utils.building.list.setData({ planetId: planet.id }, (old) =>
        old?.map((b) =>
          b.id === vars.buildingId
            ? { ...b, isUpgrading: true, upgradeEndTime: new Date(Date.now() + b.nextLevelTime * 1000).toISOString() }
            : b,
        ),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) utils.building.list.setData({ planetId: planet.id }, ctx.previous);
    },
    onSettled: invalidate,
  });
  const cancelMutation = trpc.building.cancel.useMutation({ onSettled: invalidate });

  if (!buildings) {
    return (
      <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
        Chargement…
      </div>
    );
  }

  const levels = Object.fromEntries(buildings.map((b) => [b.id, b.currentLevel]));
  const upgrading = buildings.find((b) => b.isUpgrading && b.upgradeEndTime);
  const rows = buildings.filter((b) => {
    const atMax = b.maxLevel != null && b.currentLevel >= b.maxLevel;
    const prereqsMet = b.prerequisites.every((pr) => (pr.currentLevel ?? levels[pr.buildingId] ?? 0) >= pr.level);
    return !atMax && prereqsMet;
  });
  const lockedCount = buildings.length - rows.length;

  return (
    <div className="space-y-2">
      {upgrading && upgrading.upgradeEndTime && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs font-semibold text-amber-400">
              {upgrading.name} → Nv.{upgrading.currentLevel + 1}
            </span>
            <button
              type="button"
              onClick={() => cancelMutation.mutate({ planetId: planet.id })}
              disabled={cancelMutation.isPending}
              aria-label="Annuler la construction"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-amber-400 transition-colors duration-fast hover:bg-destructive/20 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Timer
            endTime={new Date(upgrading.upgradeEndTime)}
            totalDuration={upgrading.nextLevelTime}
            onComplete={invalidate}
          />
        </div>
      )}

      <ul className="space-y-1.5">
        {rows.map((b) => {
          const canAfford =
            planet.minerai >= b.nextLevelCost.minerai &&
            planet.silicium >= b.nextLevelCost.silicium &&
            planet.hydrogene >= b.nextLevelCost.hydrogene;
          const disabled = !!upgrading || !canAfford || upgradeMutation.isPending;
          return (
            <li
              key={b.id}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {b.name}
                  <span className="text-muted-foreground tabular-nums"> · Nv.{b.currentLevel}</span>
                </span>
                <span className="flex items-center gap-2.5 text-xs tabular-nums">
                  {b.nextLevelCost.minerai > 0 && (
                    <span className={planet.minerai >= b.nextLevelCost.minerai ? 'text-minerai' : 'text-destructive'}>
                      <MineraiIcon size={10} className="mr-0.5 inline" />
                      {formatCompact(b.nextLevelCost.minerai)}
                    </span>
                  )}
                  {b.nextLevelCost.silicium > 0 && (
                    <span className={planet.silicium >= b.nextLevelCost.silicium ? 'text-silicium' : 'text-destructive'}>
                      <SiliciumIcon size={10} className="mr-0.5 inline" />
                      {formatCompact(b.nextLevelCost.silicium)}
                    </span>
                  )}
                  {b.nextLevelCost.hydrogene > 0 && (
                    <span className={planet.hydrogene >= b.nextLevelCost.hydrogene ? 'text-hydrogene' : 'text-destructive'}>
                      <HydrogeneIcon size={10} className="mr-0.5 inline" />
                      {formatCompact(b.nextLevelCost.hydrogene)}
                    </span>
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => upgradeMutation.mutate({ planetId: planet.id, buildingId: b.id as never })}
                disabled={disabled}
                title={!canAfford ? 'Ressources insuffisantes' : upgrading ? 'Une construction est déjà en cours' : `Améliorer ${b.name}`}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-fast',
                  disabled
                    ? 'border border-border text-muted-foreground-soft cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      {lockedCount > 0 && (
        <button
          type="button"
          onClick={() => onNavigate(`/planet/${planet.id}/infrastructures`)}
          className="block w-full rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground transition-colors duration-fast hover:text-foreground"
        >
          {lockedCount} bâtiment{lockedCount > 1 ? 's' : ''} au niveau max ou verrouillé{lockedCount > 1 ? 's' : ''} — voir la page
        </button>
      )}
    </div>
  );
}
