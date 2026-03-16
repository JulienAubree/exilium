import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResourceCost } from '@/components/common/ResourceCost';
import { Timer } from '@/components/common/Timer';
import { GameImage } from '@/components/common/GameImage';
import { formatDuration } from '@/lib/format';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { EntityDetailOverlay, InfoButton } from '@/components/common/EntityDetailOverlay';
import { BuildingDetailContent } from '@/components/entity-details/BuildingDetailContent';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  mineraiProduction, siliciumProduction, hydrogeneProduction,
  solarPlantEnergy, mineraiMineEnergy, siliciumMineEnergy, hydrogeneSynthEnergy,
  storageCapacity,
} from '@ogame-clone/game-engine';

interface ProductionStats {
  current: number;
  next: number;
  delta: number;
  label: string;
  unit: string;
  color: string;
  energyCurrent?: number;
  energyNext?: number;
  energyDelta?: number;
}

function getProductionStats(
  buildingId: string,
  level: number,
  maxTemp: number,
  productionFactor: number,
): ProductionStats | null {
  const pf = productionFactor;
  switch (buildingId) {
    case 'mineraiMine':
      return {
        current: mineraiProduction(level, pf),
        next: mineraiProduction(level + 1, pf),
        delta: mineraiProduction(level + 1, pf) - mineraiProduction(level, pf),
        label: 'Production', unit: '/h', color: 'text-emerald-400',
        energyCurrent: mineraiMineEnergy(level),
        energyNext: mineraiMineEnergy(level + 1),
        energyDelta: mineraiMineEnergy(level + 1) - mineraiMineEnergy(level),
      };
    case 'siliciumMine':
      return {
        current: siliciumProduction(level, pf),
        next: siliciumProduction(level + 1, pf),
        delta: siliciumProduction(level + 1, pf) - siliciumProduction(level, pf),
        label: 'Production', unit: '/h', color: 'text-emerald-400',
        energyCurrent: siliciumMineEnergy(level),
        energyNext: siliciumMineEnergy(level + 1),
        energyDelta: siliciumMineEnergy(level + 1) - siliciumMineEnergy(level),
      };
    case 'hydrogeneSynth':
      return {
        current: hydrogeneProduction(level, maxTemp, pf),
        next: hydrogeneProduction(level + 1, maxTemp, pf),
        delta: hydrogeneProduction(level + 1, maxTemp, pf) - hydrogeneProduction(level, maxTemp, pf),
        label: 'Production', unit: '/h', color: 'text-emerald-400',
        energyCurrent: hydrogeneSynthEnergy(level),
        energyNext: hydrogeneSynthEnergy(level + 1),
        energyDelta: hydrogeneSynthEnergy(level + 1) - hydrogeneSynthEnergy(level),
      };
    case 'solarPlant':
      return {
        current: solarPlantEnergy(level),
        next: solarPlantEnergy(level + 1),
        delta: solarPlantEnergy(level + 1) - solarPlantEnergy(level),
        label: 'Énergie', unit: '', color: 'text-amber-400',
      };
    case 'storageMinerai':
    case 'storageSilicium':
    case 'storageHydrogene':
      return {
        current: storageCapacity(level),
        next: storageCapacity(level + 1),
        delta: storageCapacity(level + 1) - storageCapacity(level),
        label: 'Capacité', unit: '', color: 'text-sky-400',
      };
    default:
      return null;
  }
}

export default function Buildings() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const utils = trpc.useUtils();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: gameConfig } = useGameConfig();

  const { data: buildings, isLoading } = trpc.building.list.useQuery(
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

  const upgradeMutation = trpc.building.upgrade.useMutation({
    onSuccess: () => {
      utils.building.list.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
    },
  });

  const cancelMutation = trpc.building.cancel.useMutation({
    onSuccess: () => {
      utils.building.list.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
      setCancelConfirm(false);
    },
  });

  if (isLoading || !buildings) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Bâtiments" />
        <CardGridSkeleton count={6} />
      </div>
    );
  }

  const isAnyUpgrading = buildings.some((b) => b.isUpgrading);
  const maxTemp = resourceData?.maxTemp ?? 50;
  const productionFactor = resourceData?.rates.productionFactor ?? 1;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Bâtiments" />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {buildings.map((building) => {
          const canAfford =
            resources.minerai >= building.nextLevelCost.minerai &&
            resources.silicium >= building.nextLevelCost.silicium &&
            resources.hydrogene >= building.nextLevelCost.hydrogene;

          const unmetPrereqs = building.prerequisites.filter((prereq) => {
            const prereqBuilding = buildings.find((b) => b.id === prereq.buildingId);
            return !prereqBuilding || prereqBuilding.currentLevel < prereq.level;
          });
          const prereqsMet = unmetPrereqs.length === 0;

          const stats = getProductionStats(building.id, building.currentLevel, maxTemp, productionFactor);

          return (
            <Card key={building.id} className="relative hover:shadow-glow-minerai/20">
              <InfoButton onClick={() => setDetailId(building.id)} />
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <GameImage
                    category="buildings"
                    id={building.id}
                    size="icon"
                    alt={building.name}
                    className="h-10 w-10 rounded"
                  />
                  <div className="flex flex-1 items-center justify-between">
                    <CardTitle className="text-base">{building.name}</CardTitle>
                    <Badge variant="secondary">Niv. {building.currentLevel}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{building.description}</p>

                {stats && building.currentLevel > 0 && (
                  <div className="rounded-md bg-muted/30 px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{stats.label} actuelle :</span>
                      <span className={`font-mono font-medium ${stats.color}`}>
                        {stats.current.toLocaleString('fr-FR')}{stats.unit}
                      </span>
                    </div>
                    {stats.energyCurrent != null && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Énergie consommée :</span>
                        <span className="font-mono font-medium text-amber-400">
                          -{stats.energyCurrent.toLocaleString('fr-FR')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {stats && (
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
                    <div className="text-xs text-muted-foreground mb-1">Niveau {building.currentLevel + 1} :</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{stats.label} :</span>
                      <span className={`font-mono font-medium ${stats.color}`}>
                        {stats.next.toLocaleString('fr-FR')}{stats.unit}
                        <span className="text-xs ml-1 opacity-75">(+{stats.delta.toLocaleString('fr-FR')})</span>
                      </span>
                    </div>
                    {stats.energyDelta != null && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Énergie :</span>
                        <span className="font-mono font-medium text-amber-400">
                          -{stats.energyNext!.toLocaleString('fr-FR')}
                          <span className="text-xs ml-1 opacity-75">(-{stats.energyDelta.toLocaleString('fr-FR')})</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    Coût niveau {building.currentLevel + 1} :
                  </div>
                  <ResourceCost
                    minerai={building.nextLevelCost.minerai}
                    silicium={building.nextLevelCost.silicium}
                    hydrogene={building.nextLevelCost.hydrogene}
                    currentMinerai={resources.minerai}
                    currentSilicium={resources.silicium}
                    currentHydrogene={resources.hydrogene}
                  />
                  <div className="text-xs text-muted-foreground">
                    Durée : {formatDuration(building.nextLevelTime)}
                  </div>
                </div>

                {!prereqsMet && (
                  <p className="text-xs text-destructive">
                    Prérequis : {unmetPrereqs.map((p) => {
                      const b = buildings.find((b) => b.id === p.buildingId);
                      return b ? `${b.name} niv. ${p.level}` : `${p.buildingId} niv. ${p.level}`;
                    }).join(', ')}
                  </p>
                )}

                {building.isUpgrading && building.upgradeEndTime ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-primary">En construction...</span>
                      </div>
                      <Timer
                        endTime={new Date(building.upgradeEndTime)}
                        totalDuration={building.nextLevelTime}
                        onComplete={() => {
                          utils.building.list.invalidate({ planetId: planetId! });
                          utils.resource.production.invalidate({ planetId: planetId! });
                        }}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setCancelConfirm(true)}
                      disabled={cancelMutation.isPending}
                    >
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      upgradeMutation.mutate({
                        planetId: planetId!,
                        buildingId: building.id as any,
                      })
                    }
                    disabled={!canAfford || !prereqsMet || isAnyUpgrading || upgradeMutation.isPending}
                  >
                    Améliorer au niv. {building.currentLevel + 1}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EntityDetailOverlay
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detailId ? gameConfig?.buildings[detailId]?.name ?? '' : ''}
      >
        {detailId && (
          <BuildingDetailContent
            buildingId={detailId}
            planetContext={resourceData ? {
              maxTemp: resourceData.maxTemp,
              productionFactor: resourceData.rates.productionFactor,
            } : undefined}
          />
        )}
      </EntityDetailOverlay>

      <ConfirmDialog
        open={cancelConfirm}
        onConfirm={() => cancelMutation.mutate({ planetId: planetId! })}
        onCancel={() => setCancelConfirm(false)}
        title="Annuler la construction ?"
        description="Les ressources investies seront partiellement remboursées."
        variant="destructive"
        confirmLabel="Annuler la construction"
      />
    </div>
  );
}
