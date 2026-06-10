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
      {/* Command bar — bas de l'écran, centrée (desktop) */}
      <div className="fixed bottom-4 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2 py-1.5 shadow-raised lg:flex">
        {RAIL.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => toggle(r.id)}
            aria-pressed={!!open[r.id]}
            title={`${r.label} (${r.shortcut})`}
            className={cn(
              'flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-fast',
              open[r.id]
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <r.icon width={16} height={16} />
            <span>{r.label}</span>
            <kbd className="rounded border border-border px-1 text-xs leading-tight text-muted-foreground">{r.shortcut}</kbd>
          </button>
        ))}
      </div>

      {open.planete && <PlanetPanel />}
      {open.flotte && <FleetPanel />}
      {open.empire && <EmpirePanel />}
    </>
  );
}
