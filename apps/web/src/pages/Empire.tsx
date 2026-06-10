import { useMemo, useState } from 'react';
import { trpc } from '@/trpc';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { EntityDetailOverlay } from '@/components/common/EntityDetailOverlay';
import { EmpireHero } from '@/components/empire/EmpireHero';
import { EmpireHelp } from '@/components/empire/EmpireHelp';
import { EmpireKpiBar } from '@/components/empire/EmpireKpiBar';
import { EmpirePlanetCard } from '@/components/empire/EmpirePlanetCard';
import { EmpirePlanetRow } from '@/components/empire/EmpirePlanetRow';
import { EmpirePlanetTable } from '@/components/empire/EmpirePlanetTable';
import { EmpireViewToggle } from '@/components/empire/EmpireViewToggle';
import { ReorderableEmpireGrid } from '@/components/empire/ReorderableEmpireGrid';
import type { EmpireViewMode, PlanetFleetData } from '@/components/empire/empire-types';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore, useIsQuart } from '@/stores/theme.store';
import { cn } from '@/lib/utils';
import { ArrowUpDown, LayoutGrid, Table2 } from 'lucide-react';

export default function Empire() {
  const utils = trpc.useUtils();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = trpc.planet.empire.useQuery();
  const { data: fleetOverview } = trpc.shipyard.empireOverview.useQuery();
  const { data: governance } = trpc.colonization.governance.useQuery();
  const [isReordering, setIsReordering] = useState(false);
  const [viewMode, setViewMode] = useState<EmpireViewMode>('resources');
  const [helpOpen, setHelpOpen] = useState(false);

  // « Quart de nuit » S0 : sous le thème lab, le home se lit en table
  // (défaut), les cartes restent à un clic. Hors thème : cartes, comme avant.
  const isQuart = useIsQuart();
  const empireDisplay = useThemeStore((s) => s.empireDisplay);
  const setEmpireDisplay = useThemeStore((s) => s.setEmpireDisplay);
  const display: 'cards' | 'table' = isQuart ? (empireDisplay ?? 'table') : 'cards';

  const fleetByPlanet = useMemo(() => {
    const map = new Map<string, PlanetFleetData>();
    if (!fleetOverview) return map;
    for (const p of fleetOverview.planets) {
      map.set(p.id, {
        ships: p.ships,
        totalShips: p.totalShips,
        totalFP: p.totalFP,
        totalCargo: p.totalCargo,
      });
    }
    return map;
  }, [fleetOverview]);

  const reorderMutation = trpc.planet.reorder.useMutation({
    onSuccess: () => {
      utils.planet.empire.invalidate();
      utils.planet.list.invalidate();
      setIsReordering(false);
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <EmpireHero
          username={user?.username ?? 'Empereur'}
          avatarId={user?.avatarId ?? null}
          planetCount={0}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <div className="px-4 lg:px-6">
          <CardGridSkeleton count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isReordering ? 'pb-28 lg:pb-24' : ''}`}>
      <EmpireHero
        username={user?.username ?? 'Empereur'}
        avatarId={user?.avatarId ?? null}
        planetCount={data.planets.length}
        activeFleetCount={data.activeFleetCount}
        inboundAttackCount={data.inboundAttackCount}
        onOpenHelp={() => setHelpOpen(true)}
        actions={
          !isReordering ? (
            <div className="flex items-center gap-2">
              {isQuart && (
                <div className="hidden lg:inline-flex rounded-md border border-border p-0.5 bg-card/40">
                  <button
                    type="button"
                    onClick={() => setEmpireDisplay('table')}
                    aria-pressed={display === 'table'}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                      display === 'table' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmpireDisplay('cards')}
                    aria-pressed={display === 'cards'}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                      display === 'cards' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Cartes
                  </button>
                </div>
              )}
              {/* Le toggle ressources/flotte pilote cartes (desktop) et lignes
                  (mobile) — quand la table est active il ne sert qu'au mobile. */}
              <div className={display === 'table' ? 'lg:hidden' : undefined}>
                <EmpireViewToggle mode={viewMode} onChange={setViewMode} />
              </div>
              {data.planets.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsReordering(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Réorganiser</span>
                </button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="space-y-4 px-4 lg:px-6">
        <EmpireKpiBar
          totalRates={data.totalRates}
          activeFleetCount={data.activeFleetCount}
          inboundAttackCount={data.inboundAttackCount}
          governance={governance}
          planets={data.planets}
        />

        {isReordering ? (
          <ReorderableEmpireGrid
            planets={data.planets}
            onSave={(order) => reorderMutation.mutate({ order })}
            onCancel={() => setIsReordering(false)}
            isSaving={reorderMutation.isPending}
          />
        ) : (
          <>
            {/* Desktop : table (« Quart de nuit » S0) ou grille de cartes */}
            {display === 'table' ? (
              <div className="hidden lg:block">
                <EmpirePlanetTable planets={data.planets} />
              </div>
            ) : (
              <div className="hidden lg:grid lg:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] lg:gap-4 lg:items-start">
                {data.planets.map((planet, i) => (
                  <EmpirePlanetCard
                    key={planet.id}
                    planet={planet}
                    isFirst={i === 0}
                    allPlanets={data.planets}
                    fleet={fleetByPlanet.get(planet.id)}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}

            {/* Mobile list */}
            <div className="lg:hidden">
              {data.planets.map((planet, i) => (
                <EmpirePlanetRow
                  key={planet.id}
                  planet={planet}
                  isFirst={i === 0}
                  isLast={i === data.planets.length - 1}
                  allPlanets={data.planets}
                  fleet={fleetByPlanet.get(planet.id)}
                  viewMode={viewMode}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <EntityDetailOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Empire"
      >
        <EmpireHelp />
      </EntityDetailOverlay>
    </div>
  );
}
