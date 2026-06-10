import { useNavigate } from 'react-router';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';
import { Timer } from '@/components/common/Timer';
import { MissionIcon } from '@/components/fleet/MissionIcon';
import { useGameConfig } from '@/hooks/useGameConfig';
import { usePanelStore } from '@/stores/panel.store';
import { PanelWindow } from './PanelWindow';
import { FleetIcon } from '@/lib/icons';

const PHASE_LABELS: Record<string, string> = {
  outbound: 'aller',
  return: 'retour',
  prospecting: 'prospection',
  mining: 'extraction',
  exploring: 'exploration',
};

/**
 * Panneau Flotte (Passerelle P1) : mouvements en cours, slots, hostiles —
 * consultable par-dessus n'importe quel écran (raccourci F).
 */
export function FleetPanel() {
  const navigate = useNavigate();
  const close = usePanelStore((s) => s.close);
  const { data: gameConfig } = useGameConfig();
  const { data: movements } = trpc.fleet.movements.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: inboundFleets } = trpc.fleet.inbound.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: slots } = trpc.fleet.slots.useQuery();
  const utils = trpc.useUtils();

  const hostiles = (inboundFleets ?? []).filter((f) => f.hostile);

  const go = (path: string) => {
    close('flotte');
    navigate(path, { viewTransition: true });
  };

  return (
    <PanelWindow
      title="Flotte"
      icon={<FleetIcon width={16} height={16} className="text-primary" />}
      shortcut="F"
      onClose={() => close('flotte')}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
          <span className="text-xs text-muted-foreground">Slots de flotte</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {slots?.current ?? 0}
            <span className="font-normal text-muted-foreground"> / {slots?.max ?? '–'}</span>
          </span>
        </div>

        {hostiles.length > 0 && (
          <button
            type="button"
            onClick={() => go('/fleet/movements')}
            className="flex w-full items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-left text-sm text-destructive"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 animate-pulse-glow" />
            {hostiles.length} flotte{hostiles.length > 1 ? 's' : ''} hostile{hostiles.length > 1 ? 's' : ''} en approche
          </button>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Mouvements en cours</span>
            <span className="text-xs tabular-nums text-muted-foreground">{movements?.length ?? 0}</span>
          </div>
          {movements && movements.length > 0 ? (
            <ul className="space-y-1.5">
              {movements.map((m) => {
                const missionLabel = gameConfig?.missions?.[m.mission]?.label ?? m.mission;
                // MissionIcon ne connaît pas les missions système — repli visuel.
                const iconMission = (
                  m.mission === 'colonization_raid' ? 'attack' : m.mission === 'anomaly' ? 'explore' : m.mission
                ) as Parameters<typeof MissionIcon>[0]['mission'];
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => go('/fleet/movements')}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors duration-fast hover:border-border-strong"
                    >
                      <MissionIcon mission={iconMission} size={16} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {missionLabel}
                          <span className="text-muted-foreground"> · {PHASE_LABELS[m.phase] ?? m.phase}</span>
                        </span>
                        <span className="block text-xs tabular-nums text-muted-foreground">
                          [{m.targetGalaxy}:{m.targetSystem}:{m.targetPosition}]
                        </span>
                      </span>
                      <span className={cn('shrink-0 text-xs tabular-nums', m.phase === 'return' ? 'text-muted-foreground' : 'text-primary')}>
                        <Timer
                          endTime={new Date(m.arrivalTime)}
                          onComplete={() => {
                            utils.fleet.movements.invalidate();
                            utils.fleet.inbound.invalidate();
                          }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              Aucune flotte en mouvement
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => go('/fleet/send')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors duration-fast hover:bg-primary/90"
          >
            Envoyer une flotte
          </button>
          <button
            type="button"
            onClick={() => go('/fleet')}
            className="flex items-center justify-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
          >
            Tout voir
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </PanelWindow>
  );
}
