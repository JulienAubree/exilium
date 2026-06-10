import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';
import { usePanelStore } from '@/stores/panel.store';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { getPlanetImageUrl } from '@/lib/assets';

/**
 * Dock planète flottant (desktop) : la planète active est visible sur tous
 * les écrans, avec sélecteur intégré — elle reste le contexte de nombreuses
 * actions (origine des envois de flotte, imports…). Masqué dans le
 * drill-down /planet/* où l'en-tête joue déjà ce rôle.
 * Clic sur l'image → drill-down ; clic sur le nom → sélecteur.
 */
export function FloatingPlanetDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: planets } = trpc.planet.list.useQuery();
  const activePlanetId = usePlanetStore((s) => s.activePlanetId);
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const togglePanel = usePanelStore((s) => s.toggle);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  if (location.pathname.startsWith('/planet/')) return null;

  const active = planets?.find((p) => p.id === activePlanetId) ?? planets?.[0];
  if (!active) return null;

  return (
    <div ref={ref} className="fixed bottom-4 left-6 z-40 hidden lg:block">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-surface-raised p-1 shadow-raised animate-slide-up">
          {planets?.map((p) => {
            const isActive = p.id === active.id;
            const colonizing = p.status === 'colonizing';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActivePlanet(p.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-fast',
                  isActive ? 'bg-primary/10' : 'hover:bg-accent',
                )}
              >
                {p.planetClassId && p.planetImageIndex != null ? (
                  <img
                    src={getPlanetImageUrl(p.planetClassId, p.planetImageIndex, 'icon')}
                    alt=""
                    className={cn('h-8 w-8 rounded-full object-cover', colonizing && 'opacity-60')}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                    {p.name.charAt(0)}
                  </div>
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-sm', isActive ? 'font-semibold text-primary' : 'text-foreground')}>
                    {p.name}
                  </span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    [{p.galaxy}:{p.system}:{p.position}]{colonizing && ' · colonisation'}
                  </span>
                </span>
                <span
                  role="link"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePlanet(p.id);
                    setOpen(false);
                    navigate(`/planet/${p.id}`, { viewTransition: true });
                  }}
                  className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-primary"
                  title={`Ouvrir ${p.name}`}
                >
                  →
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-full border border-border bg-surface-raised py-1.5 pl-1.5 pr-3 shadow-raised">
        <button
          type="button"
          onClick={() => { setOpen(false); togglePanel('planete'); }}
          title={`${active.name} — panneau (P)`}
          className="shrink-0 rounded-full transition-transform duration-fast hover:scale-105"
        >
          {active.planetClassId && active.planetImageIndex != null ? (
            <img
              src={getPlanetImageUrl(active.planetClassId, active.planetImageIndex, 'icon')}
              alt={active.name}
              className="h-10 w-10 rounded-full border border-border-strong object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-muted-foreground">
              {active.name.charAt(0)}
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex min-w-0 items-center gap-1.5 text-left"
        >
          <span className="min-w-0">
            <span className="block max-w-32 truncate text-sm font-semibold text-foreground">{active.name}</span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              [{active.galaxy}:{active.system}:{active.position}]
            </span>
          </span>
          <ChevronUp className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-fast', open && 'rotate-180')} />
        </button>
      </div>
    </div>
  );
}
