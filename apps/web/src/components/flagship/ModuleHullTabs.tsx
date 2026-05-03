import { cn } from '@/lib/utils';

interface Props {
  activeHullId: string;
  selectedHull: string;
  onSelect: (hullId: string) => void;
}

const HULLS: Array<{ id: string; label: string }> = [
  { id: 'combat',     label: 'Combat' },
  { id: 'scientific', label: 'Scientifique' },
  { id: 'industrial', label: 'Industrielle' },
];

export function ModuleHullTabs({ activeHullId, selectedHull, onSelect }: Props) {
  return (
    <div className="flex gap-1 border-b border-border/40">
      {HULLS.map((h) => {
        const isSelected = h.id === selectedHull;
        const isActive = h.id === activeHullId;
        return (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors relative',
              isSelected ? 'text-hull-300' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {h.label}
            {isActive && <span className="ml-1.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40 px-1 py-0 text-[8px] text-emerald-300">ACTIF</span>}
            {isSelected && <span className="absolute inset-x-1 -bottom-px h-px bg-hull-400" />}
          </button>
        );
      })}
    </div>
  );
}
