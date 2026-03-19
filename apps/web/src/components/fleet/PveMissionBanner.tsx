import { trpc } from '@/trpc';
import { Badge } from '@/components/ui/badge';

interface PveMissionBannerProps {
  pveMissionId: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-900/50 text-green-300 border-green-700',
  medium: 'bg-orange-900/50 text-orange-300 border-orange-700',
  hard: 'bg-red-900/50 text-red-300 border-red-700',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
};

export function PveMissionBanner({ pveMissionId }: PveMissionBannerProps) {
  const { data: mission } = trpc.pve.getMissionById.useQuery(
    { missionId: pveMissionId },
    { staleTime: 60_000 },
  );

  if (!mission) return null;

  const params = mission.parameters as Record<string, unknown>;
  const rewards = mission.rewards as Record<string, unknown>;
  const coords = `[${params.galaxy}:${params.system}:${params.position}]`;

  if (mission.missionType === 'mine') {
    const resourceType = (params.resourceType ?? rewards.resourceType) as string;
    const estimatedQty = rewards.estimatedQuantity as number | undefined;
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-800/60 bg-blue-950/40 p-3">
        <span className="text-xl">⛏</span>
        <div>
          <div className="text-sm font-semibold text-blue-300">Extraction minière</div>
          <div className="text-xs text-blue-400/80">
            {resourceType}{estimatedQty ? ` — ~${estimatedQty.toLocaleString()} unités` : ''} — Ceinture {coords}
          </div>
        </div>
      </div>
    );
  }

  // Pirate mission
  const tier = mission.difficultyTier ?? 'easy';
  const minerai = (rewards.minerai as number) ?? 0;
  const silicium = (rewards.silicium as number) ?? 0;
  const hydrogene = (rewards.hydrogene as number) ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-800/60 bg-red-950/40 p-3">
      <span className="text-xl">☠</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-red-300">Repaire pirate</span>
          <Badge className={DIFFICULTY_COLORS[tier]}>{DIFFICULTY_LABELS[tier]}</Badge>
        </div>
        <div className="text-xs text-red-400/80">
          {coords} — Récompense : {minerai.toLocaleString()} minerai, {silicium.toLocaleString()} silicium, {hydrogene.toLocaleString()} H₂
        </div>
      </div>
    </div>
  );
}
