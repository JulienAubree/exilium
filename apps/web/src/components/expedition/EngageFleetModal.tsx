import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useToastStore } from '@/stores/toast.store';
import { Button } from '@/components/ui/button';
import { GameImage } from '@/components/common/GameImage';
import { X, Fuel, Package, Anchor, AlertCircle, Check, MapPin, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  mission: {
    id: string;
    sectorName: string;
    tier: 'early' | 'mid' | 'deep';
    totalSteps: number;
    estimatedDurationSeconds: number;
    briefing: string;
  };
  /** Planète actuellement sélectionnée dans le layout (présélectionnée). */
  defaultPlanetId?: string;
  onEngaged: () => void;
}

const TIER_LABEL = {
  early: 'Initial',
  mid: 'Intermédiaire',
  deep: 'Profond',
} as const;

const TIER_BADGE = {
  early: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  mid: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  deep: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
} as const;

const fmt = (n: number) => Number(n).toLocaleString('fr-FR');

export function EngageFleetModal({ open, onClose, mission, defaultPlanetId, onEngaged }: Props) {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const { data: gameConfig } = useGameConfig();
  const { data: planets } = trpc.planet.list.useQuery(undefined, { enabled: open });

  const [planetId, setPlanetId] = useState<string | null>(null);
  const [ships, setShips] = useState<Record<string, number>>({});

  // Préselectionne la planète courante quand le modal s'ouvre
  useEffect(() => {
    if (!open) return;
    if (planetId) return;
    if (defaultPlanetId) {
      setPlanetId(defaultPlanetId);
    } else if (planets && planets.length > 0) {
      // Fallback : homeworld si trouvé, sinon première planète
      const homeworld = planets.find((p: any) => p.planetClassId === 'homeworld');
      setPlanetId((homeworld ?? planets[0]).id);
    }
  }, [open, defaultPlanetId, planets, planetId]);

  // Récupère les ships effectivement présents sur la planète sélectionnée
  const { data: planetShipsData } = trpc.shipyard.ships.useQuery(
    { planetId: planetId! },
    { enabled: open && !!planetId },
  );

  const selectedPlanet = useMemo(
    () => planets?.find((p: any) => p.id === planetId) ?? null,
    [planets, planetId],
  );

  const hydrogenBaseCost = useMemo(() => {
    if (!gameConfig?.universe) return 0;
    const key = mission.tier === 'deep'
      ? 'expedition_hydrogen_base_cost_deep'
      : mission.tier === 'mid'
      ? 'expedition_hydrogen_base_cost_mid'
      : 'expedition_hydrogen_base_cost_early';
    return Number((gameConfig.universe as Record<string, unknown>)[key]) || 200;
  }, [gameConfig, mission.tier]);

  const hydrogenMassFactor = Number((gameConfig?.universe as Record<string, unknown> | undefined)?.expedition_hydrogen_mass_factor) || 0.4;

  // Préviz flotte
  const preview = useMemo(() => {
    if (!gameConfig?.ships) return null;
    let totalCargo = 0;
    let totalMass = 0;
    let totalHull = 0;
    let explorerCount = 0;
    let shipCount = 0;
    for (const [shipId, count] of Object.entries(ships)) {
      if (count <= 0) continue;
      const def = (gameConfig.ships as Record<string, any>)[shipId];
      if (!def) continue;
      totalCargo += (def.cargoCapacity ?? 0) * count;
      totalMass += (def.fuelConsumption ?? 1) * count;
      totalHull += (def.hull ?? 1) * count;
      shipCount += count;
      if (def.role === 'exploration') explorerCount += count;
    }
    const hydrogenCost = Math.ceil(hydrogenBaseCost + totalMass * hydrogenMassFactor);
    return { totalCargo, totalMass, totalHull, explorerCount, shipCount, hydrogenCost };
  }, [ships, gameConfig, hydrogenBaseCost, hydrogenMassFactor]);

  const planetShipsAvailable = useMemo(() => {
    if (!planetShipsData) return [] as Array<{ id: string; name: string; count: number; categoryId?: string; role?: string }>;
    return planetShipsData
      .filter((item) => item.count > 0)
      .map((item) => ({
        id: item.id,
        name: item.name,
        count: item.count,
        categoryId: (gameConfig?.ships as Record<string, any>)?.[item.id]?.categoryId,
        role: (gameConfig?.ships as Record<string, any>)?.[item.id]?.role,
      }));
  }, [planetShipsData, gameConfig]);

  const planetHydrogene = selectedPlanet
    ? Math.floor(Number((selectedPlanet as Record<string, unknown>).hydrogene ?? 0))
    : 0;
  const insufficientHydrogen = preview ? planetHydrogene < preview.hydrogenCost : false;
  const noExplorer = preview ? preview.explorerCount === 0 : true;
  const canEngage = !noExplorer && !insufficientHydrogen && !!planetId && preview && preview.totalHull > 0;

  const engageMutation = trpc.expedition.engage.useMutation({
    onSuccess: () => {
      addToast(`Expédition vers ${mission.sectorName} engagée.`, 'success');
      utils.expedition.list.invalidate();
      utils.planet.list.invalidate();
      onEngaged();
      onClose();
    },
    onError: (e) => {
      addToast(e.message ?? 'Engagement impossible', 'error');
    },
  });

  if (!open) return null;

  const handleShipChange = (shipId: string, value: number) => {
    const max = planetShipsAvailable.find((s) => s.id === shipId)?.count ?? 0;
    const clamped = Math.max(0, Math.min(max, value));
    setShips((prev) => ({ ...prev, [shipId]: clamped }));
  };

  // Group ships par catégorie pour affichage en sections
  const shipCategories = (gameConfig?.categories ?? [])
    .filter((c) => c.entityType === 'ship')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl border border-border/40 bg-card/95 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 p-1.5 rounded-md hover:bg-white/10 backdrop-blur-sm bg-background/40 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 bg-gradient-to-br from-card/80 to-card/30">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <Compass className="h-3 w-3" />
            <span>Engagement d'expédition</span>
            <span>·</span>
            <span className={cn('px-1.5 py-0.5 rounded-full border text-[9px] font-bold', TIER_BADGE[mission.tier])}>
              Palier {TIER_LABEL[mission.tier]}
            </span>
            <span>·</span>
            <span>{mission.totalSteps} étapes</span>
            <span>·</span>
            <span>~{Math.round(mission.estimatedDurationSeconds / 60)} min</span>
          </div>
          <h2 className="text-xl font-bold">{mission.sectorName}</h2>
          <p className="text-xs text-muted-foreground italic mt-1 max-w-2xl">« {mission.briefing} »</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Sélecteur planète visuel */}
          <section className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              Planète d'origine
            </label>
            {planets && planets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {planets.map((p: any) => {
                  const isSelected = p.id === planetId;
                  const h2 = Math.floor(Number(p.hydrogene ?? 0));
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (p.id !== planetId) {
                          setPlanetId(p.id);
                          setShips({});
                        }
                      }}
                      className={cn(
                        'retro-card relative overflow-hidden text-left transition-all',
                        isSelected
                          ? 'border-primary shadow-[0_0_16px_-4px_rgba(34,211,238,0.5)] ring-1 ring-primary/40'
                          : 'border-border/40 hover:border-border/70',
                      )}
                    >
                      <div className="relative h-16 overflow-hidden">
                        <GameImage
                          category="planets"
                          id={p.planetClassId ?? 'homeworld'}
                          size="full"
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-md">
                            <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="p-2 space-y-0.5">
                        <div className="text-[13px] font-semibold truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          [{p.galaxy}:{p.system}:{p.position}]
                        </div>
                        <div className="text-[10px] text-hydrogene tabular-nums">
                          H₂ {fmt(h2)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Chargement…</p>
            )}
          </section>

          {/* Sélecteur ships visuel */}
          {planetId && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Anchor className="h-3 w-3" />
                  Composition de la flotte
                </label>
                {planetShipsAvailable.length > 0 && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShips({})}
                      className="h-7 px-2 text-[11px]"
                    >
                      Tout vider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const all: Record<string, number> = {};
                        for (const s of planetShipsAvailable) all[s.id] = s.count;
                        setShips(all);
                      }}
                      className="h-7 px-2 text-[11px]"
                    >
                      Tout max
                    </Button>
                  </div>
                )}
              </div>

              {planetShipsAvailable.length === 0 ? (
                <div className="rounded-lg border border-border/30 bg-card/30 p-6 text-center text-sm text-muted-foreground">
                  Aucun vaisseau disponible sur cette planète.
                </div>
              ) : (
                shipCategories.map((category) => {
                  const categoryShips = planetShipsAvailable.filter((s) => s.categoryId === category.id);
                  if (categoryShips.length === 0) return null;

                  return (
                    <div key={category.id} className="space-y-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {category.name}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {categoryShips.map((s) => {
                          const value = ships[s.id] ?? 0;
                          const isExplorer = s.role === 'exploration';
                          const isSelected = value > 0;
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                'retro-card overflow-hidden transition-all',
                                isSelected
                                  ? 'border-primary/60 ring-1 ring-primary/30'
                                  : 'border-border/40',
                                isExplorer && !isSelected && 'border-cyan-500/30',
                              )}
                            >
                              <div className="relative h-20 overflow-hidden">
                                <GameImage
                                  category="ships"
                                  id={s.id}
                                  size="full"
                                  alt={s.name}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full backdrop-blur-sm tabular-nums">
                                  / {fmt(s.count)}
                                </span>
                                {isExplorer && (
                                  <span className="absolute top-1.5 left-1.5 bg-cyan-500/80 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                                    Explo
                                  </span>
                                )}
                                {isSelected && (
                                  <div className="absolute bottom-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums shadow-md">
                                    {fmt(value)}
                                  </div>
                                )}
                              </div>
                              <div className="p-2 space-y-1.5">
                                <div className="text-[12px] font-semibold truncate">{s.name}</div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    max={s.count}
                                    value={value}
                                    onChange={(e) => handleShipChange(s.id, parseInt(e.target.value) || 0)}
                                    className="flex-1 min-w-0 bg-background/60 border border-border/40 rounded px-1.5 py-1 text-[11px] tabular-nums"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleShipChange(s.id, s.count)}
                                    className="px-1.5 py-1 rounded border border-border/40 hover:bg-white/5 text-[10px] font-semibold"
                                  >
                                    Max
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          )}

          {/* Préviz flotte */}
          {preview && preview.shipCount > 0 && (
            <section className="rounded-lg border border-border/40 bg-card/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aperçu de l'engagement</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <Anchor className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Flotte</div>
                    <div className="font-semibold tabular-nums">{fmt(preview.shipCount)} vaisseaux</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Soute</div>
                    <div className="font-semibold tabular-nums">{fmt(preview.totalCargo)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Anchor className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Coque totale</div>
                    <div className="font-semibold tabular-nums">{fmt(preview.totalHull)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Coût H₂</div>
                    <div className={cn('font-semibold tabular-nums', insufficientHydrogen && 'text-rose-300')}>
                      {fmt(preview.hydrogenCost)}
                      {selectedPlanet && (
                        <span className="text-muted-foreground/70 font-normal"> / {fmt(planetHydrogene)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {(noExplorer || insufficientHydrogen) && (
                <div className="space-y-1 pt-2 border-t border-border/20">
                  {noExplorer && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-300">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Au moins un vaisseau d'exploration est requis</span>
                    </div>
                  )}
                  {insufficientHydrogen && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-300">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>Hydrogène insuffisant sur cette planète</span>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-white/5 bg-card/95 backdrop-blur-sm">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!canEngage || engageMutation.isPending}
            onClick={() => {
              if (!planetId) return;
              engageMutation.mutate({
                missionId: mission.id,
                planetId,
                ships,
              });
            }}
            className="gap-1.5"
          >
            <Fuel className="h-3.5 w-3.5" />
            {engageMutation.isPending ? 'Engagement…' : `Engager (${fmt(preview?.hydrogenCost ?? 0)} H₂)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
