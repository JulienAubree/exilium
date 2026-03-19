import { cn } from '@/lib/utils';
import { MISSION_CONFIG, type Mission } from '@/config/mission-config';

interface MissionSelectorProps {
  selected: Mission | null;
  onChange: (mission: Mission) => void;
  locked: boolean;
}

const MISSIONS: Mission[] = ['transport', 'station', 'spy', 'attack', 'colonize', 'recycle', 'mine', 'pirate'];

export function MissionSelector({ selected, onChange, locked }: MissionSelectorProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase text-muted-foreground">Mission</span>
        {locked && (
          <span className="text-xs text-yellow-500">🔒 Verrouillée pour cette mission</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MISSIONS.map((m) => {
          const config = MISSION_CONFIG[m];
          const isSelected = selected === m;
          return (
            <button
              key={m}
              onClick={() => !locked && onChange(m)}
              disabled={locked && !isSelected}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                isSelected
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                  : locked
                    ? 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer',
              )}
            >
              {isSelected && '✓ '}{config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
