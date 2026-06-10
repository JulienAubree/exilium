import type { ReactNode } from 'react';
import { Pencil, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HeroAtmosphere } from '@/components/common/HeroAtmosphere';
import { AllianceTagBadge } from './AllianceTagBadge';

const PLAYSTYLE_LABELS: Record<string, string> = {
  miner: 'Mineur',
  warrior: 'Guerrier',
  explorer: 'Explorateur',
};

/** Progression d'empire affichée dans le héro (profil perso uniquement). */
export interface EmpireHeroData {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  capacity: number;
  missionLevel: number;
  capacityLevelsPerColony: number;
  missionLevelsPerBonus: number;
}

interface ProfileHeroProps {
  username: string;
  avatarId: string | null;
  rank: number | null;
  bio: string | null;
  createdAt: string | Date;
  playstyle: 'miner' | 'warrior' | 'explorer' | null;
  seekingAlliance: boolean | null;
  allianceTag: string | null;
  onEditAvatar?: () => void;
  empire?: EmpireHeroData | null;
}

function AvatarFallback({ username }: { username: string }) {
  return (
    <span className="text-2xl font-bold text-primary">
      {username.slice(0, 2).toUpperCase()}
    </span>
  );
}

function formatJoinMonth(createdAt: string | Date): string {
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d);
}

function tagline(bio: string | null, createdAt: string | Date): string {
  if (bio && bio.trim().length > 0) {
    const firstLine = bio.split('\n')[0].trim();
    return firstLine.length > 90 ? firstLine.slice(0, 87) + '…' : firstLine;
  }
  return `Aux commandes depuis ${formatJoinMonth(createdAt)}`;
}

export function ProfileHero({
  username,
  avatarId,
  rank,
  bio,
  createdAt,
  playstyle,
  seekingAlliance,
  allianceTag,
  onEditAvatar,
  empire,
}: ProfileHeroProps) {
  const phrase = tagline(bio, createdAt);
  const title = empire ? `Empereur niveau ${empire.level}` : 'Capitaine';
  const rankLine = rank != null ? `${title} · Rang ${rank}` : title;
  const avatarUrl = avatarId ? `/assets/avatars/${avatarId}.webp` : null;

  // Progression vers le niveau suivant + prochains paliers (cf. EmpireLevelCard
  // d'origine : le prochain +1 capacité est le niveau où la formule dépasse la
  // capacité actuelle).
  const isMaxLevel = empire ? empire.nextLevelXp === null : false;
  const xpSpan = empire && empire.nextLevelXp !== null ? empire.nextLevelXp - empire.currentLevelXp : 1;
  const xpInLevel = empire ? Math.max(0, empire.xp - empire.currentLevelXp) : 0;
  const xpProgress = empire && !isMaxLevel ? Math.min(1, xpInLevel / xpSpan) : 1;
  const nextCapacityLevel = empire ? empire.capacity * empire.capacityLevelsPerColony + 1 : 0;
  const nextMissionLevel = empire
    ? empire.level + (empire.missionLevelsPerBonus - ((empire.level - 1) % empire.missionLevelsPerBonus))
    : 0;

  const avatar: ReactNode = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={username}
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-card">
      <AvatarFallback username={username} />
    </div>
  );

  return (
    <div className="relative overflow-hidden">
      <HeroAtmosphere imageUrl={avatarUrl} variant="indigo" />

      {/* Alliance monogram (top-right corner) */}
      {allianceTag && (
        <div className="absolute top-3 right-3 z-10 lg:top-4 lg:right-4">
          <AllianceTagBadge tag={allianceTag} size="sm" />
        </div>
      )}

      {/* Content row */}
      <div className="relative px-5 pt-8 pb-6 lg:px-8 lg:pt-10 lg:pb-8">
        <div className="flex items-start gap-5">
          {/* Avatar with optional edit pencil */}
          <div className="relative group shrink-0">
            <div
              className={cn(
                'h-20 w-20 lg:h-24 lg:w-24 rounded-full overflow-hidden border-2 shadow-lg',
                empire
                  ? 'border-amber-500/50 shadow-amber-500/15'
                  : 'border-primary/30 shadow-primary/10',
                onEditAvatar && 'cursor-pointer transition-all group-hover:ring-2 group-hover:ring-primary/40 group-hover:shadow-primary/20',
              )}
              onClick={onEditAvatar}
              role={onEditAvatar ? 'button' : undefined}
              aria-label={onEditAvatar ? 'Changer d\'avatar' : undefined}
            >
              {avatar}
            </div>
            {/* Badge de niveau d'empereur */}
            {empire && (
              <div
                className="absolute -bottom-1 -left-1 flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-full border border-amber-400/60 bg-gradient-to-b from-amber-600 to-amber-800 px-1.5 shadow-md shadow-amber-900/40"
                title={`Empereur niveau ${empire.level}`}
              >
                <Crown className="h-3 w-3 text-amber-200" />
                <span className="text-xs font-bold text-amber-100">{empire.level}</span>
              </div>
            )}
            {onEditAvatar && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditAvatar(); }}
                className="absolute bottom-0 right-0 flex items-center justify-center w-7 h-7 rounded-full bg-surface border border-primary/40 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Changer d'avatar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Text stack */}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-xl lg:text-2xl font-bold text-foreground truncate">{username}</h1>
            <p className={cn('text-sm mt-0.5', empire ? 'text-amber-400 font-medium' : 'text-muted-foreground')}>
              {rankLine}
            </p>
            <p className="text-xs italic text-muted-foreground mt-2 leading-relaxed">{phrase}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {playstyle && (
                <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300">
                  {PLAYSTYLE_LABELS[playstyle] ?? playstyle}
                </span>
              )}
              {seekingAlliance === true && (
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                  Cherche une alliance
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progression impériale intégrée */}
        {empire && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>
                {isMaxLevel
                  ? 'Niveau maximum atteint'
                  : `${xpInLevel.toLocaleString('fr-FR')} / ${xpSpan.toLocaleString('fr-FR')} XP vers le niveau ${empire.level + 1}`}
              </span>
              <span className="hidden sm:inline">
                Gouvernance <span className="font-semibold text-amber-400">{empire.capacity}</span>
                {!isMaxLevel && <span className="text-muted-foreground/70"> (+1 niv. {nextCapacityLevel})</span>}
                <span className="mx-1.5 text-muted-foreground/40">·</span>
                Missions <span className="font-semibold text-amber-400">niv. {empire.missionLevel}</span>
                {!isMaxLevel && <span className="text-muted-foreground/70"> (+1 niv. {nextMissionLevel})</span>}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-950/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all"
                style={{ width: `${Math.round(xpProgress * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground/70 sm:hidden">
              Gouvernance {empire.capacity}{!isMaxLevel && ` (+1 niv. ${nextCapacityLevel})`} · Missions niv. {empire.missionLevel}{!isMaxLevel && ` (+1 niv. ${nextMissionLevel})`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
