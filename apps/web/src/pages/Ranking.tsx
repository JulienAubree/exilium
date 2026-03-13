import { useState } from 'react';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Ranking() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: rankings, isLoading } = trpc.ranking.list.useQuery({ page, limit });
  const { data: myRank } = trpc.ranking.me.useQuery();

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Classement</h1>

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
              {rankings?.map((entry) => (
                <tr key={entry.userId} className="border-b border-border/50">
                  <td className="px-2 py-1 font-mono">{entry.rank}</td>
                  <td className="px-2 py-1">{entry.username}</td>
                  <td className="px-2 py-1 text-right">{entry.totalPoints.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              {(!rankings || rankings.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">
                    Aucun classement disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground self-center">Page {page}</span>
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
