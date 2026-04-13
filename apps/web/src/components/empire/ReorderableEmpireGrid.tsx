import { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmpirePlanetCard } from './EmpirePlanetCard';
import { getPlanetImageUrl } from '@/lib/assets';

type EmpirePlanet = Parameters<typeof EmpirePlanetCard>[0]['planet'];

interface ReorderableEmpireGridProps {
  planets: EmpirePlanet[];
  onSave: (order: { planetId: string; sortOrder: number }[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ReorderableEmpireGrid({
  planets,
  onSave,
  onCancel,
  isSaving,
}: ReorderableEmpireGridProps) {
  const [orderedPlanets, setOrderedPlanets] = useState(planets);

  const move = useCallback((index: number, direction: -1 | 1) => {
    setOrderedPlanets((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      return arrayMove(prev, index, target);
    });
  }, []);

  const handleSave = () => {
    onSave(orderedPlanets.map((planet, i) => ({ planetId: planet.id, sortOrder: i })));
  };

  return (
    <>
      <div className="space-y-1">
        {orderedPlanets.map((planet, i) => (
          <div
            key={planet.id}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/80 p-2 lg:p-3"
          >
            {/* Position number */}
            <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>

            {/* Planet thumbnail */}
            {planet.planetClassId && planet.planetImageIndex != null ? (
              <img
                src={getPlanetImageUrl(planet.planetClassId, planet.planetImageIndex, 'thumb')}
                alt={planet.name}
                className="h-9 w-9 shrink-0 rounded-full border border-border/50 object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-xs font-semibold text-muted-foreground">
                {planet.name.charAt(0)}
              </div>
            )}

            {/* Planet info */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{planet.name}</div>
              <div className="text-xs text-muted-foreground">
                [{planet.galaxy}:{planet.system}:{planet.position}]
              </div>
            </div>

            {/* Arrow buttons */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md border border-border/50 transition-colors',
                  i === 0
                    ? 'opacity-25 cursor-default'
                    : 'bg-card hover:bg-accent/60 active:bg-accent',
                )}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={i === orderedPlanets.length - 1}
                onClick={() => move(i, 1)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md border border-border/50 transition-colors',
                  i === orderedPlanets.length - 1
                    ? 'opacity-25 cursor-default'
                    : 'bg-card hover:bg-accent/60 active:bg-accent',
                )}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg px-4 py-3 lg:bottom-0">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? 'Enregistrement...' : 'Valider'}
          </button>
        </div>
      </div>
    </>
  );
}
