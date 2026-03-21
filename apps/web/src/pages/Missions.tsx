import { useNavigate } from 'react-router';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { Timer } from '@/components/common/Timer';

const TIER_LABELS: Record<string, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

const TIER_COLORS: Record<string, string> = {
  easy: 'bg-green-500/20 text-green-400 border-green-500/40',
  medium: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  hard: 'bg-red-500/20 text-red-400 border-red-500/40',
};


export default function Missions() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.pve.getMissions.useQuery();
  const dismissMutation = trpc.pve.dismissMission.useMutation({
    onSuccess: () => {
      utils.pve.getMissions.invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Missions" />
        <CardGridSkeleton count={4} />
      </div>
    );
  }

  const centerLevel = data?.centerLevel ?? 0;
  const missions = data?.missions ?? [];
  const nextDiscoveryAt = data?.nextDiscoveryAt ? new Date(data.nextDiscoveryAt) : null;
  const nextDiscoveryInFuture = nextDiscoveryAt && nextDiscoveryAt.getTime() > Date.now();

  if (centerLevel === 0) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Missions" />
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Vous devez construire un <span className="font-semibold text-primary">Centre de missions</span> pour
            débloquer les missions PvE.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Missions" />

      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Centre de missions :</span>
          <span className="font-semibold text-primary">Niveau {centerLevel}</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            {missions.length}/3 gisement{missions.length !== 1 ? 's' : ''} découvert{missions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {nextDiscoveryInFuture && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Prochaine découverte dans</span>
            <Timer
              endTime={nextDiscoveryAt}
              onComplete={() => utils.pve.getMissions.invalidate()}
            />
          </div>
        )}
      </div>

      <div className="glass-card border-primary/20 bg-primary/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-primary">Comment fonctionnent les missions ?</h3>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Votre Centre de missions <span className="text-foreground">découvre automatiquement</span> de nouveaux gisements miniers au fil du temps.</li>
          <li>Jusqu'à <span className="text-foreground">3 missions maximum</span> peuvent être découvertes en même temps. Au-delà, les découvertes sont perdues.</li>
          <li>Un gisement reste exploitable <span className="text-foreground">tant qu'il contient des ressources</span> — envoyez plusieurs flottes pour le vider entièrement.</li>
          <li>Vous pouvez <span className="text-foreground">annuler</span> un gisement qui ne vous intéresse pas pour libérer un emplacement (cooldown 24h).</li>
          <li>Upgrader le Centre de missions = découvertes plus fréquentes, gisements plus gros, extraction plus efficace.</li>
        </ul>
      </div>

      {missions.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune mission disponible pour le moment. De nouvelles missions apparaissent régulièrement.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((mission) => {
            const params = mission.parameters as Record<string, any>;
            const rewards = mission.rewards as Record<string, any>;
            const isMining = mission.missionType === 'mine';

            return (
              <div key={mission.id} className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {isMining ? 'Extraction minière' : 'Repaire pirate'}
                  </span>
                  {!isMining && mission.difficultyTier && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        TIER_COLORS[mission.difficultyTier] ?? ''
                      }`}
                    >
                      {TIER_LABELS[mission.difficultyTier] ?? mission.difficultyTier}
                    </span>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Coordonnées : [{params.galaxy}:{params.system}:{params.position}]
                </div>

                {isMining ? (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Ressources estimées :</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {rewards.minerai > 0 && (
                        <span className="text-minerai">M: {Number(rewards.minerai).toLocaleString('fr-FR')}</span>
                      )}
                      {rewards.silicium > 0 && (
                        <span className="text-silicium">S: {Number(rewards.silicium).toLocaleString('fr-FR')}</span>
                      )}
                      {rewards.hydrogene > 0 && (
                        <span className="text-hydrogene">H: {Number(rewards.hydrogene).toLocaleString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Récompenses :</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {rewards.minerai > 0 && (
                        <span className="text-minerai">M: {Number(rewards.minerai).toLocaleString('fr-FR')}</span>
                      )}
                      {rewards.silicium > 0 && (
                        <span className="text-silicium">S: {Number(rewards.silicium).toLocaleString('fr-FR')}</span>
                      )}
                      {rewards.hydrogene > 0 && (
                        <span className="text-hydrogene">H: {Number(rewards.hydrogene).toLocaleString('fr-FR')}</span>
                      )}
                    </div>
                    {rewards.bonusShips?.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        + vaisseaux bonus possibles
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const missionType = isMining ? 'mine' : 'pirate';
                      navigate(
                        `/fleet?mission=${missionType}&galaxy=${params.galaxy}&system=${params.system}&position=${params.position}&pveMissionId=${mission.id}`,
                      );
                    }}
                  >
                    {isMining ? 'Envoyer' : 'Attaquer'}
                  </Button>
                  {isMining && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dismissMutation.mutate({ missionId: mission.id })}
                      disabled={dismissMutation.isPending}
                      title="Annuler ce gisement"
                    >
                      Annuler
                    </Button>
                  )}
                </div>
                {dismissMutation.error && (
                  <div className="text-xs text-red-400">{dismissMutation.error.message}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
