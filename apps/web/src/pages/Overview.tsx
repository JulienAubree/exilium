import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Timer } from '@/components/common/Timer';
import { OverviewSkeleton } from '@/components/common/PageSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';

export default function Overview() {
  const { planetId } = useOutletContext<{ planetId?: string }>();
  const navigate = useNavigate();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const utils = trpc.useUtils();

  const { data: planets, isLoading } = trpc.planet.list.useQuery();

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

  const { data: buildings } = trpc.building.list.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: techs } = trpc.research.list.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: queue } = trpc.shipyard.queue.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const renameMutation = trpc.planet.rename.useMutation({
    onSuccess: () => {
      utils.planet.list.invalidate();
      setIsRenaming(false);
    },
  });

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  const planet = planets?.find((p) => p.id === planetId) ?? planets?.[0];
  if (!planet) {
    return (
      <div className="p-6">
        <EmptyState title="Aucune planète trouvée" description="Aucune planète n'est associée à votre compte." />
      </div>
    );
  }

  const activeBuilding = buildings?.find((b) => b.isUpgrading);
  const activeResearch = techs?.find((t) => t.isResearching);
  const activeQueue = queue?.filter((q) => q.endTime) ?? [];
  const hasActivity = activeBuilding || activeResearch || activeQueue.length > 0;

  const activityBorderColor = (type: string) => {
    switch (type) {
      case 'building': return 'border-l-4 border-l-primary';
      case 'research': return 'border-l-4 border-l-violet-500';
      case 'shipyard': return 'border-l-4 border-l-orange-500';
      default: return '';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Vue d'ensemble" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Activités en cours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasActivity && (
            <EmptyState title="Aucune activité" description="Lancez une construction, une recherche ou un chantier." />
          )}

          {activeBuilding && activeBuilding.upgradeEndTime && (
            <div
              className={`cursor-pointer space-y-1 rounded-md p-3 hover:bg-muted/50 ${activityBorderColor('building')}`}
              onClick={() => navigate('/buildings')}
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Construction</Badge>
                  <span>{activeBuilding.name} → Niv. {activeBuilding.currentLevel + 1}</span>
                </div>
              </div>
              <Timer
                endTime={new Date(activeBuilding.upgradeEndTime)}
                totalDuration={activeBuilding.nextLevelTime}
                onComplete={() => {
                  utils.building.list.invalidate({ planetId: planetId! });
                  utils.resource.production.invalidate({ planetId: planetId! });
                }}
              />
            </div>
          )}

          {activeResearch && activeResearch.researchEndTime && (
            <div
              className={`cursor-pointer space-y-1 rounded-md p-3 hover:bg-muted/50 ${activityBorderColor('research')}`}
              onClick={() => navigate('/research')}
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Recherche</Badge>
                  <span>{activeResearch.name} → Niv. {activeResearch.currentLevel + 1}</span>
                </div>
              </div>
              <Timer
                endTime={new Date(activeResearch.researchEndTime)}
                totalDuration={activeResearch.nextLevelTime}
                onComplete={() => {
                  utils.research.list.invalidate({ planetId: planetId! });
                }}
              />
            </div>
          )}

          {activeQueue.map((item) => (
            <div
              key={item.id}
              className={`cursor-pointer space-y-1 rounded-md p-3 hover:bg-muted/50 ${activityBorderColor('shipyard')}`}
              onClick={() => navigate('/shipyard')}
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Chantier</Badge>
                  <span>{item.itemId} x{item.quantity - (item.completedCount ?? 0)}</span>
                </div>
              </div>
              {item.endTime && (
                <Timer
                  endTime={new Date(item.endTime)}
                  totalDuration={Math.floor((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 1000)}
                  onComplete={() => {
                    utils.shipyard.queue.invalidate({ planetId: planetId! });
                    utils.shipyard.ships.invalidate({ planetId: planetId! });
                  }}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            {isRenaming ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newName.trim()) {
                    renameMutation.mutate({ planetId: planet.id, name: newName.trim() });
                  }
                }}
              >
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={30}
                  className="h-8"
                />
                <Button type="submit" size="sm" disabled={renameMutation.isPending}>
                  OK
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setIsRenaming(false)}>
                  Annuler
                </Button>
              </form>
            ) : (
              <CardTitle
                className={!planet.renamed ? 'cursor-pointer hover:text-primary transition-colors' : ''}
                onClick={!planet.renamed ? () => { setNewName(planet.name); setIsRenaming(true); } : undefined}
                title={!planet.renamed ? 'Cliquer pour renommer' : undefined}
              >
                {planet.name}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coordonnées</span>
              <span>[{planet.galaxy}:{planet.system}:{planet.position}]</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Diamètre</span>
              <span>{planet.diameter.toLocaleString('fr-FR')} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Champs</span>
              <span>0 / {planet.maxFields}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Température</span>
              <span>{planet.minTemp}°C à {planet.maxTemp}°C</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ressources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-minerai glow-minerai">Minerai</span>
              <span>{resources.minerai.toLocaleString('fr-FR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-silicium glow-silicium">Silicium</span>
              <span>{resources.silicium.toLocaleString('fr-FR')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-hydrogene glow-hydrogene">Hydrogène</span>
              <span>{resources.hydrogene.toLocaleString('fr-FR')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bâtiments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mine de minerai</span>
              <Badge variant="secondary">Niv. {planet.mineraiMineLevel}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mine de silicium</span>
              <Badge variant="secondary">Niv. {planet.siliciumMineLevel}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Synth. H₂</span>
              <Badge variant="secondary">Niv. {planet.hydrogeneSynthLevel}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Centrale solaire</span>
              <Badge variant="secondary">Niv. {planet.solarPlantLevel}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
