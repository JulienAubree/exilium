import { useNavigate } from 'react-router';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';

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
  const { data, isLoading } = trpc.pve.getMissions.useQuery();

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

      <div className="glass-card p-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Centre de missions :</span>
          <span className="font-semibold text-primary">Niveau {centerLevel}</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            {missions.length} mission{missions.length !== 1 ? 's' : ''} disponible{missions.length !== 1 ? 's' : ''}
          </span>
        </div>
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

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const missionType = isMining ? 'mine' : 'pirate';
                    navigate(
                      `/fleet?mission=${missionType}&galaxy=${params.galaxy}&system=${params.system}&position=${params.position}&pveMissionId=${mission.id}`,
                    );
                  }}
                >
                  {isMining ? 'Envoyer' : 'Attaquer'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
