import { useRef, useState } from 'react';
import { Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlanetImageUrl } from '@/lib/assets';
import { useOutsideClick } from '@/hooks/useOutsideClick';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  planetClassId: string | null;
  planetImageIndex: number | null;
  status?: string;
}

interface Props {
  planetId: string | null;
  planets: Planet[];
  onSelect: (id: string) => void;
}

export function PlanetSelectorDropdown({ planetId, planets, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  const activePlanet = planets.find((p) => p.id === planetId);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm touch-feedback hover:bg-accent"
      >
        {activePlanet?.planetClassId && activePlanet.planetImageIndex != null ? (
          <img
            src={getPlanetImageUrl(activePlanet.planetClassId, activePlanet.planetImageIndex, 'icon')}
            alt=""
            className="w-5 h-5 rounded-full object-cover"
          />
        ) : (
          <span className="w-5 h-5 rounded-full bg-primary/30 inline-block" />
        )}
        <span className="font-medium">
          {activePlanet ? activePlanet.name : 'Planète'}
          {activePlanet && (
            <span className="hidden lg:inline"> [{activePlanet.galaxy}:{activePlanet.system}:{activePlanet.position}]</span>
          )}
        </span>
        <span className="text-xs">&#9660;</span>
      </button>

      {open && (
        <div className="fixed left-2 right-2 top-12 z-50 mt-1 sm:absolute sm:right-auto sm:left-0 sm:top-full sm:min-w-48 rounded-md border border-white/10 bg-card/95 backdrop-blur-lg shadow-lg animate-slide-up">
          {planets.map((planet) => {
            const isColonizing = planet.status === 'colonizing';
            return (
              <button
                key={planet.id}
                onClick={() => { onSelect(planet.id); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent',
                  planet.id === planetId && 'bg-primary/10 text-primary',
                )}
              >
                <span className="relative inline-flex">
                  {planet.planetClassId && planet.planetImageIndex != null ? (
                    <img
                      src={getPlanetImageUrl(planet.planetClassId, planet.planetImageIndex, 'icon')}
                      alt=""
                      className={cn('w-5 h-5 rounded-full object-cover', isColonizing && 'ring-1 ring-amber-400/70')}
                    />
                  ) : (
                    <span className={cn('w-5 h-5 rounded-full bg-primary/30 inline-block', isColonizing && 'ring-1 ring-amber-400/70')} />
                  )}
                </span>
                <span className="flex-1 text-left">
                  {planet.name} [{planet.galaxy}:{planet.system}:{planet.position}]
                </span>
                {isColonizing && (
                  <span
                    className="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400"
                    title="Colonisation en cours"
                  >
                    <Rocket className="h-2.5 w-2.5 animate-pulse" />
                    Colonisation
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
