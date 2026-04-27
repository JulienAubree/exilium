import { Layers, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmpireViewMode } from './empire-types';

interface Props {
  mode: EmpireViewMode;
  onChange: (mode: EmpireViewMode) => void;
}

export function EmpireViewToggle({ mode, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5 bg-card/40">
      <ToggleButton active={mode === 'resources'} onClick={() => onChange('resources')} icon={<Package className="h-3.5 w-3.5" />}>
        Ressources
      </ToggleButton>
      <ToggleButton active={mode === 'fleet'} onClick={() => onChange('fleet')} icon={<Layers className="h-3.5 w-3.5" />}>
        Flotte
      </ToggleButton>
    </div>
  );
}

function ToggleButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
