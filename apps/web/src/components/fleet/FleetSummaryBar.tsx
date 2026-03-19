import { Button } from '@/components/ui/button';
import type { Mission } from '@/config/mission-config';
import { MISSION_CONFIG } from '@/config/mission-config';

interface FleetSummaryBarProps {
  mission: Mission | null;
  selectedShips: Record<string, number>;
  totalCargo: number;
  cargoCapacity: number;
  fuel: number | null;
  duration: number | null;
  disabled: boolean;
  sending: boolean;
  onSend: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export function FleetSummaryBar({ mission, selectedShips, totalCargo, cargoCapacity, fuel, duration, disabled, sending, onSend }: FleetSummaryBarProps) {
  const shipCount = Object.values(selectedShips).reduce((sum, n) => sum + n, 0);

  const config = mission ? MISSION_CONFIG[mission] : null;
  const buttonLabel = config?.buttonLabel ?? 'Envoyer';

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {shipCount > 0 ? (
            <>
              {shipCount} vaisseau{shipCount > 1 ? 'x' : ''} &bull; Cargo : {totalCargo.toLocaleString()}/{cargoCapacity.toLocaleString()}
            </>
          ) : (
            'Aucun vaisseau sélectionné'
          )}
        </div>
        <Button
          size="sm"
          disabled={disabled || sending}
          onClick={onSend}
          variant={config?.dangerous ? 'destructive' : 'default'}
        >
          {sending ? 'Envoi...' : buttonLabel}
        </Button>
      </div>
      {shipCount > 0 && fuel != null && duration != null && (
        <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
          <span>⛽ {fuel.toLocaleString()} hydrogène</span>
          <span>⏱ {formatDuration(duration)} (aller)</span>
        </div>
      )}
    </div>
  );
}
