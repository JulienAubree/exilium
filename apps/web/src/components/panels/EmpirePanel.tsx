import { useNavigate } from 'react-router';
import { ArrowRight, Crown, Landmark, TrendingUp } from 'lucide-react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';
import { usePanelStore } from '@/stores/panel.store';
import { PanelWindow } from './PanelWindow';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from '@/components/common/ResourceIcons';
import { EmpireIcon } from '@/lib/icons';

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.floor(value));
}

/**
 * Panneau Empire (Passerelle P3) : la synthèse du règne en un coup d'œil —
 * niveau, gouvernance, production, signaux (stocks saturés, surextension).
 */
export function EmpirePanel() {
  const navigate = useNavigate();
  const close = usePanelStore((s) => s.close);
  const { data: progression } = trpc.empireProgression.get.useQuery();
  const { data: governance } = trpc.colonization.governance.useQuery();
  const { data: empire } = trpc.planet.empire.useQuery(undefined, { refetchInterval: 60_000 });

  const go = (path: string) => {
    close('empire');
    navigate(path, { viewTransition: true });
  };

  const saturated = (empire?.planets ?? []).filter((p) => {
    const full = (v: number, max?: number) => (max ?? 0) > 0 && v / (max as number) > 0.95;
    return (
      full(p.minerai, p.storageMineraiCapacity) ||
      full(p.silicium, p.storageSiliciumCapacity) ||
      full(p.hydrogene, p.storageHydrogeneCapacity)
    );
  }).length;

  const xpInLevel =
    progression && progression.nextLevelXp !== null
      ? progression.xp - progression.currentLevelXp
      : 0;
  const xpSpan =
    progression && progression.nextLevelXp !== null
      ? progression.nextLevelXp - progression.currentLevelXp
      : 1;

  return (
    <PanelWindow
      title="Empire"
      icon={<EmpireIcon width={16} height={16} className="text-primary" />}
      shortcut="E"
      onClose={() => close('empire')}
    >
      <div className="space-y-3">
        {/* Rang impérial */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-400">
              <Crown className="h-4 w-4" aria-hidden />
              Empereur niveau {progression?.level ?? '–'}
            </span>
            {progression?.nextLevelXp !== null && progression && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {xpInLevel.toLocaleString('fr-FR')} / {xpSpan.toLocaleString('fr-FR')} XP
              </span>
            )}
          </div>
          {progression && progression.nextLevelXp !== null && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-amber-950/60">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${Math.round(Math.min(1, xpInLevel / xpSpan) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Gouvernance */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Landmark className="h-3.5 w-3.5" aria-hidden />
            Gouvernance
          </span>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              governance && governance.overextend > 0
                ? 'text-destructive'
                : governance && governance.colonyCount === governance.capacity
                  ? 'text-amber-400'
                  : 'text-emerald-400',
            )}
          >
            {governance?.colonyCount ?? '–'} / {governance?.capacity ?? '–'} colonies
          </span>
        </div>

        {/* Production de l'empire */}
        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            Production horaire
          </span>
          <div className="flex items-center gap-4 tabular-nums">
            <span className="flex items-center gap-1 text-sm font-semibold text-minerai">
              <MineraiIcon size={13} />
              {formatCompact(empire?.totalRates.mineraiPerHour ?? 0)}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-silicium">
              <SiliciumIcon size={13} />
              {formatCompact(empire?.totalRates.siliciumPerHour ?? 0)}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-hydrogene">
              <HydrogeneIcon size={13} />
              {formatCompact(empire?.totalRates.hydrogenePerHour ?? 0)}
            </span>
          </div>
        </div>

        {/* Signaux */}
        {(saturated > 0 || (governance && governance.overextend > 0)) && (
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-muted-foreground">Signaux</span>
            {saturated > 0 && (
              <button
                type="button"
                onClick={() => go('/')}
                className="flex w-full items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-400 transition-colors duration-fast hover:brightness-110"
              >
                <span>{saturated} monde{saturated > 1 ? 's' : ''} aux stocks saturés — production gaspillée</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            )}
            {governance && governance.overextend > 0 && (
              <button
                type="button"
                onClick={() => go('/')}
                className="flex w-full items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive transition-colors duration-fast hover:brightness-110"
              >
                <span>Surextension : −{Math.round(governance.harvestMalus * 100)} % de récolte</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => go('/')}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors duration-fast hover:bg-primary/90"
        >
          Ouvrir l'Empire
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </PanelWindow>
  );
}
