import { Link } from 'react-router';
import { Trophy, ArrowLeft } from 'lucide-react';
import { trpc } from '@/trpc';
import { PageHeader } from '@/components/common/PageHeader';
import { RankMedalIcon } from '@/components/common/RankMedalIcon';
import { Button } from '@/components/ui/button';

export default function AnomalyLeaderboard() {
  const { data: leaderboard, isLoading } = trpc.anomaly.leaderboard.useQuery({ limit: 50 });

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader
        title="Leaderboard Anomaly"
        actions={
          <Link to="/anomalies">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          </Link>
        }
      />

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement…</div>
        ) : !leaderboard?.entries || leaderboard.entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun joueur n'a encore complété un palier.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-panel-light/50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Rang</th>
                <th className="px-3 py-2 text-left">Joueur</th>
                <th className="px-3 py-2 text-right">Palier max</th>
                <th className="px-3 py-2 text-right">Niveau</th>
                <th className="px-3 py-2 text-right">XP</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.entries.map((entry, i) => {
                const rank = i + 1;
                return (
                  <tr
                    key={`${entry.username}-${i}`}
                    className="border-t border-panel-border hover:bg-panel-hover transition-colors"
                  >
                    <td className="px-3 py-2 font-mono">
                      {rank <= 3 ? <RankMedalIcon rank={rank} size={24} /> : `#${rank}`}
                    </td>
                    <td className="px-3 py-2 font-medium">{entry.username}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1 font-bold text-yellow-400">
                        <Trophy className="h-3.5 w-3.5" />
                        {entry.maxTierCompleted}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{entry.level}</td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {Number(entry.xp).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-center text-xs text-gray-500">
        Tiebreakers : niveau pilote, puis XP cumulé.
      </div>
    </div>
  );
}
