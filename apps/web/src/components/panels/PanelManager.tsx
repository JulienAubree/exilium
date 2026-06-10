import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { usePanelStore, type PanelId } from '@/stores/panel.store';
import { FleetPanel } from './FleetPanel';
import { PlanetPanel } from './PlanetPanel';
import { EmpirePanel } from './EmpirePanel';
import { FleetIcon, OverviewIcon, EmpireIcon } from '@/lib/icons';

const RAIL: { id: PanelId; label: string; shortcut: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { id: 'planete', label: 'Planète', shortcut: 'P', icon: OverviewIcon },
  { id: 'flotte', label: 'Flotte', shortcut: 'F', icon: FleetIcon },
  { id: 'empire', label: 'Empire', shortcut: 'E', icon: EmpireIcon },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Gestionnaire des panneaux de la Passerelle (P1) : rail de toggle (bord
 * droit, desktop), raccourcis clavier (F… ; Échap ferme tout), rendu des
 * panneaux ouverts. Réf : docs/proposals/2026-06-10-la-passerelle-rts-shell.md
 */
export function PanelManager() {
  const open = usePanelStore((s) => s.open);
  const toggle = usePanelStore((s) => s.toggle);
  const closeAll = usePanelStore((s) => s.closeAll);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        closeAll();
        return;
      }
      const entry = RAIL.find((r) => r.shortcut.toLowerCase() === key);
      if (entry) {
        e.preventDefault();
        toggle(entry.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, closeAll]);

  return (
    <>
      {/* Rail de panneaux — bord droit, desktop */}
      <div className="fixed right-2 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1.5 lg:flex">
        {RAIL.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => toggle(r.id)}
            aria-pressed={!!open[r.id]}
            title={`${r.label} (${r.shortcut})`}
            className={cn(
              'flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-lg border transition-colors duration-fast',
              open[r.id]
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground hover:border-border-strong',
            )}
          >
            <r.icon width={17} height={17} />
            <span className="text-xs font-semibold leading-none">{r.shortcut}</span>
          </button>
        ))}
      </div>

      {open.planete && <PlanetPanel />}
      {open.flotte && <FleetPanel />}
      {open.empire && <EmpirePanel />}
    </>
  );
}
