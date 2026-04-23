interface AllianceHeroStatsProps {
  memberCount: number;
  rank: number;
  totalPoints: number;
  foundedAt: string;
  recentMilitary: { wins: number; losses: number; windowDays: number };
}

export function AllianceHeroStats({ memberCount, rank, totalPoints, foundedAt, recentMilitary }: AllianceHeroStatsProps) {
  const founded = new Date(foundedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const points = totalPoints.toLocaleString('fr-FR');
  const { wins, losses, windowDays } = recentMilitary;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>{memberCount} membre{memberCount > 1 ? 's' : ''}</span>
      <span>Rang #{rank}</span>
      <span>{points} pts</span>
      <span>Fondée le {founded}</span>
      <span className="text-foreground/80">{windowDays}j : {wins}V / {losses}D</span>
    </div>
  );
}
