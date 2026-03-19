import { Button } from '@/components/ui/button';
import type { Mission } from '@/config/mission-config';
import { MISSION_CONFIG } from '@/config/mission-config';

interface FleetSummaryBarProps {
  mission: Mission | null;
  selectedShips: Record<string, number>;
  totalCargo: number;
  cargoCapacity: number;
  disabled: boolean;
  sending: boolean;
  onSend: () => void;
}

export function FleetSummaryBar({ mission, selectedShips, totalCargo, cargoCapacity, disabled, sending, onSend }: FleetSummaryBarProps) {
  const shipCount = Object.values(selectedShips).reduce((sum, n) => sum + n, 0);

  const config = mission ? MISSION_CONFIG[mission] : null;
  const buttonLabel = config?.buttonLabel ?? 'Envoyer';

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
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
  );
}
