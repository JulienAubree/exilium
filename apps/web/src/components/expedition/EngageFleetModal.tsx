import { useMemo, useState } from 'react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useToastStore } from '@/stores/toast.store';
import { Button } from '@/components/ui/button';
import { X, Fuel, Package, Anchor, AlertCircle } from 'lucide-react';
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
  onEngaged: () => void;
}

const TIER_LABEL = {
  early: 'Initial',
  mid: 'Intermédiaire',
  deep: 'Profond',
} as const;

export function EngageFleetModal({ open, onClose, mission, onEngaged }: Props) {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const { data: gameConfig } = useGameConfig();
  const { data: planets } = trpc.planet.list.useQuery(undefined, { enabled: open });

  const [planetId, setPlanetId] = useState<string | null>(null);
  const [ships, setShips] = useState<Record<string, number>>({});

  // Auto-sélection : première planète avec un explorateur
  const explorerShipIds = useMemo(() => {
    if (!gameConfig?.ships) return [];
    return Object.entries(gameConfig.ships)
      .filter(([, def]: [string, any]) => def.role === 'exploration')
      .map(([id]) => id);
  }, [gameConfig]);

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

  // Calcul preview de la flotte
  const preview = useMemo(() => {
    if (!gameConfig?.ships) return null;
    let totalCargo = 0;
    let totalMass = 0;
    let totalHull = 0;
    let explorerCount = 0;
    for (const [shipId, count] of Object.entries(ships)) {
      if (count <= 0) continue;
      const def = (gameConfig.ships as Record<string, any>)[shipId];
      if (!def) continue;
      totalCargo += (def.cargoCapacity ?? 0) * count;
      totalMass += (def.fuelConsumption ?? 1) * count;
      totalHull += (def.hull ?? 1) * count;
      if (def.role === 'exploration') explorerCount += count;
    }
    const hydrogenCost = Math.ceil(hydrogenBaseCost + totalMass * hydrogenMassFactor);
    return { totalCargo, totalMass, totalHull, explorerCount, hydrogenCost };
  }, [ships, gameConfig, hydrogenBaseCost, hydrogenMassFactor]);

  const planetShipsAvailable = useMemo(() => {
    if (!selectedPlanet) return {} as Record<string, number>;
    const out: Record<string, number> = {};
    const sp = (selectedPlanet as Record<string, unknown>).ships as Record<string, number> | undefined;
    if (sp) for (const [k, v] of Object.entries(sp)) out[k] = Number(v) || 0;
    return out;
  }, [selectedPlanet]);

  const insufficientHydrogen = selectedPlanet && preview
    ? Number((selectedPlanet as Record<string, unknown>).hydrogene ?? 0) < preview.hydrogenCost
    : false;
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
    const max = planetShipsAvailable[shipId] ?? 0;
    const clamped = Math.max(0, Math.min(max, value));
    setShips((prev) => ({ ...prev, [shipId]: clamped }));
  };

  // Liste les ships dispos > 0 sur la planète sélectionnée
  const availableShipIds = Object.entries(planetShipsAvailable)
    .filter(([, count]) => count > 0)
    .map(([id]) => id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border/40 bg-card/95 p-6 space-y-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 p-1.5 rounded-md hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Palier {TIER_LABEL[mission.tier]} · {mission.totalSteps} étape{mission.totalSteps > 1 ? 's' : ''} · ~{Math.round(mission.estimatedDurationSeconds / 60)} min
          </p>
          <h2 className="text-lg font-bold mt-1">Engager une flotte — {mission.sectorName}</h2>
          <p className="text-xs text-muted-foreground italic mt-1">« {mission.briefing} »</p>
        </div>

        {/* Sélecteur planète */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Planète d'origine
          </label>
          <select
            value={planetId ?? ''}
            onChange={(e) => { setPlanetId(e.target.value); setShips({}); }}
            className="w-full bg-card/60 border border-border/40 rounded-md px-3 py-2 text-sm"
          >
            <option value="">— Sélectionnez —</option>
            {planets?.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.galaxy}:{p.system}:{p.position}] · H₂ {Math.floor(Number(p.hydrogene))}
              </option>
            ))}
          </select>
        </div>

        {/* Sélecteur ships */}
        {planetId && (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Composition de la flotte
            </label>
            {availableShipIds.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun vaisseau disponible sur cette planète.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {availableShipIds.map((shipId) => {
                  const def = (gameConfig?.ships as Record<string, any>)?.[shipId];
                  const max = planetShipsAvailable[shipId];
                  const value = ships[shipId] ?? 0;
                  const isExplorer = def?.role === 'exploration';
                  return (
                    <div key={shipId} className="flex items-center gap-2 rounded-md border border-border/30 bg-card/40 px-3 py-1.5">
                      <span className={cn('flex-1 text-sm truncate', isExplorer && 'text-cyan-300')}>
                        {def?.name ?? shipId}
                        {isExplorer && <span className="ml-1 text-[10px] uppercase">explorateur</span>}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">/ {max}</span>
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={value}
                        onChange={(e) => handleShipChange(shipId, parseInt(e.target.value) || 0)}
                        className="w-20 bg-background/60 border border-border/40 rounded px-2 py-1 text-sm tabular-nums"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleShipChange(shipId, max)}
                        className="h-7 px-2 text-[11px]"
                      >
                        Max
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Preview flotte */}
        {preview && Object.values(ships).some((v) => v > 0) && (
          <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aperçu</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Soute : <span className="font-semibold tabular-nums">{preview.totalCargo}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Anchor className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Coque totale : <span className="font-semibold tabular-nums">{preview.totalHull}</span></span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <Fuel className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  Coût hydrogène :{' '}
                  <span className={cn('font-semibold tabular-nums', insufficientHydrogen && 'text-rose-300')}>
                    {preview.hydrogenCost}
                  </span>
                </span>
              </div>
            </div>
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

        <div className="flex justify-end gap-2 pt-2">
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
          >
            {engageMutation.isPending ? 'Engagement…' : `Engager (${preview?.hydrogenCost ?? 0} H₂)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
