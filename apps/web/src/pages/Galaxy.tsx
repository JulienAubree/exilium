import { useState } from 'react';
import { Link } from 'react-router';
import { trpc } from '@/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/common/Skeleton';
import { PageHeader } from '@/components/common/PageHeader';

export default function Galaxy() {
  const [galaxy, setGalaxy] = useState(1);
  const [system, setSystem] = useState(1);

  const { data, isLoading } = trpc.galaxy.system.useQuery(
    { galaxy, system },
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Galaxie" />

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Galaxie</label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGalaxy(Math.max(1, galaxy - 1))}
              disabled={galaxy <= 1}
            >
              &lt;
            </Button>
            <Input
              type="number"
              min={1}
              max={9}
              value={galaxy}
              onChange={(e) => setGalaxy(Math.max(1, Math.min(9, Number(e.target.value) || 1)))}
              className="w-16 text-center"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGalaxy(Math.min(9, galaxy + 1))}
              disabled={galaxy >= 9}
            >
              &gt;
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Système</label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSystem(Math.max(1, system - 1))}
              disabled={system <= 1}
            >
              &lt;
            </Button>
            <Input
              type="number"
              min={1}
              max={499}
              value={system}
              onChange={(e) => setSystem(Math.max(1, Math.min(499, Number(e.target.value) || 1)))}
              className="w-20 text-center"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSystem(Math.min(499, system + 1))}
              disabled={system >= 499}
            >
              &gt;
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Système solaire [{galaxy}:{system}]
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden sm:table w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-1 w-12">Pos</th>
                    <th className="px-2 py-1">Planète</th>
                    <th className="px-2 py-1">Joueur</th>
                    <th className="px-2 py-1 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.slots.map((slot, i) => (
                    <tr key={i} className={`border-b border-border/50 ${!slot ? 'opacity-40' : ''}`}>
                      <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                      {slot ? (
                        <>
                          <td className="px-2 py-1">{slot.planetName}</td>
                          <td className="px-2 py-1">
                            {(slot as any).allianceTag && <span className="text-xs text-primary mr-1">[{(slot as any).allianceTag}]</span>}
                            {slot.username}
                            {(slot as any).debris && ((slot as any).debris.minerai > 0 || (slot as any).debris.silicium > 0) && (
                              <Link
                                to={`/fleet?mission=recycle&galaxy=${galaxy}&system=${system}&position=${i + 1}`}
                                className="text-xs text-orange-400 ml-2 hover:underline cursor-pointer"
                                title={`Débris: ${(slot as any).debris.minerai.toLocaleString('fr-FR')} minerai, ${(slot as any).debris.silicium.toLocaleString('fr-FR')} silicium`}
                              >
                                DF
                              </Link>
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <span className="text-xs text-muted-foreground">-</span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-muted-foreground">-</td>
                          <td className="px-2 py-1 text-muted-foreground">-</td>
                          <td className="px-2 py-1">-</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {data?.slots.map((slot, i) => (
                  <div
                    key={i}
                    className={`rounded-md border border-border/50 p-3 text-sm ${!slot ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-mono">{i + 1}</span>
                      {slot ? (
                        <span className="font-medium">{slot.planetName}</span>
                      ) : (
                        <span className="text-muted-foreground">Vide</span>
                      )}
                    </div>
                    {slot && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {(slot as any).allianceTag && <span className="text-primary mr-1">[{(slot as any).allianceTag}]</span>}
                        {slot.username}
                        {(slot as any).debris && ((slot as any).debris.minerai > 0 || (slot as any).debris.silicium > 0) && (
                          <Link
                            to={`/fleet?mission=recycle&galaxy=${galaxy}&system=${system}&position=${i + 1}`}
                            className="text-orange-400 ml-2 hover:underline"
                          >
                            DF
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
