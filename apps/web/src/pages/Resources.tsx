import { useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';

export default function Resources() {
  const { planetId } = useOutletContext<{ planetId?: string }>();

  const { data, isLoading } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const resources = useResourceCounter(
    data
      ? {
          metal: data.metal,
          crystal: data.crystal,
          deuterium: data.deuterium,
          resourcesUpdatedAt: data.resourcesUpdatedAt,
          metalPerHour: data.rates.metalPerHour,
          crystalPerHour: data.rates.crystalPerHour,
          deutPerHour: data.rates.deutPerHour,
          storageMetalCapacity: data.rates.storageMetalCapacity,
          storageCrystalCapacity: data.rates.storageCrystalCapacity,
          storageDeutCapacity: data.rates.storageDeutCapacity,
        }
      : undefined,
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Ressources" />
        <CardGridSkeleton count={2} />
      </div>
    );
  }

  const resourceRows = [
    {
      name: 'Métal',
      color: 'text-metal',
      glowClass: 'glow-metal',
      current: resources.metal,
      perHour: data.rates.metalPerHour,
      capacity: data.rates.storageMetalCapacity,
    },
    {
      name: 'Cristal',
      color: 'text-crystal',
      glowClass: 'glow-crystal',
      current: resources.crystal,
      perHour: data.rates.crystalPerHour,
      capacity: data.rates.storageCrystalCapacity,
    },
    {
      name: 'Deutérium',
      color: 'text-deuterium',
      glowClass: 'glow-deuterium',
      current: resources.deuterium,
      perHour: data.rates.deutPerHour,
      capacity: data.rates.storageDeutCapacity,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Ressources" />

      <Card>
        <CardHeader>
          <CardTitle>Production</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {resourceRows.map((r) => {
              const fillPercent = r.capacity > 0 ? Math.min(100, (r.current / r.capacity) * 100) : 0;
              return (
                <div key={r.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${r.color} ${r.glowClass}`}>{r.name}</span>
                    <div className="flex gap-6 text-sm">
                      <span>{r.current.toLocaleString('fr-FR')}</span>
                      <span className="text-muted-foreground">
                        +{r.perHour.toLocaleString('fr-FR')}/h
                      </span>
                      <span className="text-muted-foreground">
                        Cap: {r.capacity.toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-[width] duration-1000 ease-linear ${
                        fillPercent > 90 ? 'bg-destructive' : fillPercent > 70 ? 'bg-energy' : 'bg-primary'
                      }`}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Énergie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-energy font-medium glow-energy">Balance</span>
              <span
                className={`text-sm font-semibold ${
                  data.rates.energyProduced >= data.rates.energyConsumed
                    ? 'text-energy'
                    : 'text-destructive'
                }`}
              >
                {data.rates.energyProduced - data.rates.energyConsumed} ({data.rates.energyProduced} /{' '}
                {data.rates.energyConsumed})
              </span>
            </div>
            {data.rates.energyConsumed > 0 && (
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-[width] duration-500 ${
                    data.rates.energyProduced >= data.rates.energyConsumed ? 'bg-energy' : 'bg-destructive'
                  }`}
                  style={{
                    width: `${Math.min(100, (data.rates.energyProduced / Math.max(1, data.rates.energyConsumed)) * 100)}%`,
                  }}
                />
              </div>
            )}
            {data.rates.productionFactor < 1 && (
              <p className="mt-2 text-xs text-destructive">
                Facteur de production : {(data.rates.productionFactor * 100).toFixed(1)}% — Construisez
                une centrale solaire !
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
