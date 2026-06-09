import { Crown } from 'lucide-react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';

/**
 * Carte « Niveau d'empire » : niveau, barre d'XP, prochains débloquages
 * (capacité de gouvernance, niveau de missions). Remplace l'ex-Centre de
 * Pouvoir Impérial comme visualisation de la progression impériale.
 */
export function EmpireLevelCard() {
  const { data: progression } = trpc.empireProgression.get.useQuery();

  if (!progression) return null;

  const { xp, level, currentLevelXp, nextLevelXp, maxLevel, capacity, missionLevel, capacityLevelsPerColony, missionLevelsPerBonus } = progression;

  const isMaxLevel = nextLevelXp === null;
  const span = isMaxLevel ? 1 : nextLevelXp - currentLevelXp;
  const progress = isMaxLevel ? 1 : Math.min(1, Math.max(0, (xp - currentLevelXp) / span));

  // Prochain niveau qui débloque +1 capacité / +1 missions
  const nextCapacityLevel = level + (capacityLevelsPerColony - ((level - 1) % capacityLevelsPerColony));
  const nextMissionLevel = level + (missionLevelsPerBonus - ((level - 1) % missionLevelsPerBonus));

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-950/10">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
            <Crown className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-amber-400">
              Empire niveau {level}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isMaxLevel
                ? 'Niveau maximum atteint'
                : `${(xp - currentLevelXp).toLocaleString('fr-FR')} / ${span.toLocaleString('fr-FR')} XP`}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>
            Gouvernance <span className="font-semibold text-amber-400">{capacity}</span>
            {!isMaxLevel && <span className="text-muted-foreground/70"> · +1 au niv. {nextCapacityLevel}</span>}
          </span>
          <span>
            Missions <span className="font-semibold text-amber-400">niv. {missionLevel}</span>
            {!isMaxLevel && <span className="text-muted-foreground/70"> · +1 au niv. {nextMissionLevel}</span>}
          </span>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-950/60">
          <div
            className={cn('h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all')}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        {level < maxLevel && (
          <div className="mt-1.5 text-[10px] text-muted-foreground/70 sm:hidden">
            Gouvernance {capacity} (+1 niv. {nextCapacityLevel}) · Missions niv. {missionLevel} (+1 niv. {nextMissionLevel})
          </div>
        )}
      </div>
    </div>
  );
}
