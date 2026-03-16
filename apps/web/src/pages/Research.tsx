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
import { ResearchDetailContent } from '@/components/entity-details/ResearchDetailContent';
import { useGameConfig } from '@/hooks/useGameConfig';
import { formatMissingPrerequisite } from '@/lib/prerequisites';

export default function Research() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const utils = trpc.useUtils();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: gameConfig } = useGameConfig();

  const { data: techs, isLoading } = trpc.research.list.useQuery(
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

  const startMutation = trpc.research.start.useMutation({
    onSuccess: () => {
      utils.research.list.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
    },
  });

  const cancelMutation = trpc.research.cancel.useMutation({
    onSuccess: () => {
      utils.research.list.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
      setCancelConfirm(false);
    },
  });

  if (isLoading || !techs) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Recherche" />
        <CardGridSkeleton count={6} />
      </div>
    );
  }

  const isAnyResearching = techs.some((t) => t.isResearching);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Recherche" />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {techs.map((tech) => {
          const canAfford =
            resources.minerai >= tech.nextLevelCost.minerai &&
            resources.silicium >= tech.nextLevelCost.silicium &&
            resources.hydrogene >= tech.nextLevelCost.hydrogene;

          return (
            <Card key={tech.id} className={`relative ${!tech.prerequisitesMet ? 'opacity-50' : ''}`}>
              <InfoButton onClick={() => setDetailId(tech.id)} />
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <GameImage
                    category="research"
                    id={tech.id}
                    size="icon"
                    alt={tech.name}
                    className="h-10 w-10 rounded"
                  />
                  <div className="flex flex-1 items-center justify-between">
                    <CardTitle className="text-base">{tech.name}</CardTitle>
                    <Badge variant="secondary">Niv. {tech.currentLevel}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{tech.description}</p>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    Coût niveau {tech.currentLevel + 1} :
                  </div>
                  <ResourceCost
                    minerai={tech.nextLevelCost.minerai}
                    silicium={tech.nextLevelCost.silicium}
                    hydrogene={tech.nextLevelCost.hydrogene}
                    currentMinerai={resources.minerai}
                    currentSilicium={resources.silicium}
                    currentHydrogene={resources.hydrogene}
                  />
                  <div className="text-xs text-muted-foreground">
                    Durée : {formatDuration(tech.nextLevelTime)}
                  </div>
                </div>

                {!tech.prerequisitesMet && tech.missingPrerequisites.length > 0 && (
                  <p className="text-xs text-destructive">
                    Prérequis : {tech.missingPrerequisites.map((p) => formatMissingPrerequisite(p, gameConfig)).join(', ')}
                  </p>
                )}

                {tech.isResearching && tech.researchEndTime ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-primary">En recherche...</span>
                      </div>
                      <Timer
                        endTime={new Date(tech.researchEndTime)}
                        totalDuration={tech.nextLevelTime}
                        onComplete={() => {
                          utils.research.list.invalidate({ planetId: planetId! });
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
                      startMutation.mutate({ planetId: planetId!, researchId: tech.id as any })
                    }
                    disabled={!canAfford || !tech.prerequisitesMet || isAnyResearching || startMutation.isPending}
                  >
                    Rechercher niv. {tech.currentLevel + 1}
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
        title={detailId ? gameConfig?.research[detailId]?.name ?? '' : ''}
      >
        {detailId && <ResearchDetailContent researchId={detailId} />}
      </EntityDetailOverlay>

      <ConfirmDialog
        open={cancelConfirm}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setCancelConfirm(false)}
        title="Annuler la recherche ?"
        description="Les ressources investies seront partiellement remboursées."
        variant="destructive"
        confirmLabel="Annuler la recherche"
      />
    </div>
  );
}
