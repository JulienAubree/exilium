import { useMemo, type ReactNode } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { cn } from '@/lib/utils';

const RESOURCE_COLORS: Record<string, string> = {
  minerai: 'text-orange-400',
  silicium: 'text-emerald-400',
};

// Button styles — mirror ModePlanet.tsx / ExploreReportDetail.tsx
const BTN_BASE =
  'inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs border transition-colors';
const BTN_ORANGE = `${BTN_BASE} bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/25`;
const BTN_DISABLED = `${BTN_BASE} bg-white/5 text-muted-foreground border-white/5 cursor-not-allowed opacity-50`;

function ActionButton({
  enabled,
  enabledClassName,
  disabledTitle,
  enabledTitle,
  onClick,
  children,
}: {
  enabled: boolean;
  enabledClassName: string;
  disabledTitle: string;
  enabledTitle?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? enabledTitle : disabledTitle}
      className={enabled ? enabledClassName : BTN_DISABLED}
      onClick={enabled ? onClick : undefined}
    >
      {children}
    </button>
  );
}

interface RecycleReportDetailProps {
  result: Record<string, any>;
  coordinates: { galaxy: number; system: number; position: number };
}

export function RecycleReportDetail({ result, coordinates }: RecycleReportDetailProps) {
  const navigate = useNavigate();
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const { data: gameConfig } = useGameConfig();
  const { data: ships } = trpc.shipyard.ships.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const recyclerShipIds = useMemo(() => {
    if (!gameConfig?.ships) return [] as string[];
    return Object.entries(gameConfig.ships)
      .filter(([, s]) => (s as any).role === 'recycling')
      .map(([id]) => id);
  }, [gameConfig?.ships]);

  const hasRecycler = !!ships?.some(
    (s: any) => recyclerShipIds.includes(s.id) && s.count > 0,
  );

  if (result.empty) {
    return (
      <div className="space-y-4">
        <div className="glass-card border-amber-500/20 bg-amber-500/5 px-4 py-6 text-center space-y-2">
          <div className="text-amber-400 text-sm font-semibold">Rien trouvé sur place</div>
          <div className="text-xs text-muted-foreground">Aucun champ de débris à ces coordonnées. Les recycleurs sont rentrés à vide.</div>
        </div>
      </div>
    );
  }

  const collected = result.collected ?? {};
  const available = result.debrisAvailable ?? {};
  const remaining = result.debrisRemaining;
  const hasRemaining = !!remaining && ((remaining.minerai ?? 0) > 0 || (remaining.silicium ?? 0) > 0);
  const totalCollected = (collected.minerai ?? 0) + (collected.silicium ?? 0);
  const totalAvailable = (available.minerai ?? 0) + (available.silicium ?? 0);
  const cargoCapacity = result.cargoCapacity ?? 0;
  const cargoPct = cargoCapacity > 0 ? Math.round((totalCollected / cargoCapacity) * 100) : 0;
  const collectionPct = totalAvailable > 0 ? Math.round((totalCollected / totalAvailable) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Debris available */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Champ de débris</h3>
        <div className="flex flex-wrap gap-4">
          {(['minerai', 'silicium'] as const).map((r) => {
            const val = available[r] ?? 0;
            if (val === 0) return null;
            return (
              <div key={r} className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', RESOURCE_COLORS[r])}>
                  {val.toLocaleString('fr-FR')}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{r}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collection summary */}
      <div className="glass-card p-4 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recyclage</h3>

        {/* Cargo usage */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              Capacité cargo : {totalCollected.toLocaleString('fr-FR')} / {cargoCapacity.toLocaleString('fr-FR')}
            </span>
            <span className={cn('text-xs font-medium tabular-nums', cargoPct >= 90 ? 'text-emerald-400' : 'text-muted-foreground')}>
              {cargoPct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-cyan-500/70" style={{ width: `${Math.min(100, cargoPct)}%` }} />
          </div>
        </div>

        {/* Collection rate */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              Débris collectés : {collectionPct}%
            </span>
            <span className="text-xs text-muted-foreground">
              {result.recyclerCount} recycleur{result.recyclerCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.min(100, collectionPct)}%` }} />
          </div>
        </div>

        {/* Collected resources */}
        <div className="border-t border-border pt-3">
          <div className="text-xs font-semibold text-foreground mb-2">Ressources collectées</div>
          <div className="flex flex-wrap gap-4">
            {(['minerai', 'silicium'] as const).map((r) => {
              const val = collected[r] ?? 0;
              if (val === 0) return null;
              return (
                <div key={r} className="flex items-center gap-2">
                  <span className={cn('text-lg font-bold', RESOURCE_COLORS[r])}>
                    +{val.toLocaleString('fr-FR')}
                  </span>
                  <span className="text-sm text-muted-foreground capitalize">{r}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Remaining debris */}
        {hasRemaining && (
          <div className="border-t border-border pt-3 space-y-3">
            <div>
              <div className="text-xs text-amber-400 mb-1">Débris restants</div>
              <div className="flex flex-wrap gap-3">
                {(['minerai', 'silicium'] as const).map((r) => {
                  const val = remaining?.[r] ?? 0;
                  if (val === 0) return null;
                  return (
                    <span key={r} className="text-sm">
                      <span className={cn('font-medium', RESOURCE_COLORS[r])}>{val.toLocaleString('fr-FR')}</span>
                      <span className="text-muted-foreground ml-1 capitalize">{r}</span>
                    </span>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Envoyez plus de recycleurs pour collecter les débris restants.
              </p>
            </div>
            <div>
              <ActionButton
                enabled={hasRecycler}
                enabledClassName={BTN_ORANGE}
                disabledTitle="Aucun recycleur disponible"
                onClick={() =>
                  navigate(
                    `/fleet/send?mission=recycle&galaxy=${coordinates.galaxy}&system=${coordinates.system}&position=${coordinates.position}`,
                  )
                }
              >
                Envoyer des recycleurs
              </ActionButton>
            </div>
          </div>
        )}

        {!hasRemaining && (
          <p className="text-xs text-emerald-400">Champ de débris entièrement recyclé !</p>
        )}
      </div>
    </div>
  );
}
