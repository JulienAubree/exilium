import { useState } from 'react';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TablePageSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { cn } from '@/lib/utils';

const MEDALS = ['text-yellow-400', 'text-gray-300', 'text-orange-400'];

export default function Ranking() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: rankings, isLoading } = trpc.ranking.list.useQuery({ page, limit });
  const { data: myRank } = trpc.ranking.me.useQuery();

  if (isLoading) {
    return <TablePageSkeleton />;
  }

  const totalPages = rankings && rankings.length === limit ? page + 1 : page;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Classement" />

      {myRank && myRank.rank > 0 && (
        <div className="text-sm text-muted-foreground">
          Votre classement : <span className="font-bold text-primary">#{myRank.rank}</span> — {myRank.totalPoints.toLocaleString('fr-FR')} points
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classement général</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-1 w-16">Rang</th>
                <th className="px-2 py-1">Joueur</th>
                <th className="px-2 py-1 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rankings?.map((entry) => {
                const isMe = myRank && entry.userId === myRank.userId;
                const medalIdx = entry.rank - 1;
                return (
                  <tr
                    key={entry.userId}
                    className={cn(
                      'border-b border-border/50',
                      isMe && 'bg-primary/5',
                    )}
                  >
                    <td className="px-2 py-1 font-mono">
                      {medalIdx < 3 ? (
                        <span className={cn('text-lg', MEDALS[medalIdx])}>
                          {medalIdx === 0 ? '🥇' : medalIdx === 1 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        entry.rank
                      )}
                    </td>
                    <td className={cn('px-2 py-1', isMe && 'font-semibold text-primary')}>
                      {entry.username}
                    </td>
                    <td className="px-2 py-1 text-right">{entry.totalPoints.toLocaleString('fr-FR')}</td>
                  </tr>
                );
              })}
              {(!rankings || rankings.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                    Aucun classement disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Précédent
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const p = i + 1;
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(p)}
                  className="w-8 px-0"
                >
                  {p}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!rankings || rankings.length < limit}
            >
              Suivant
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
