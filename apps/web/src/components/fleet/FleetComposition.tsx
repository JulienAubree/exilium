import { categorizeShip, type Mission, type ShipCategory } from '@/config/mission-config';
import { useGameConfig } from '@/hooks/useGameConfig';
import { ShipPickCard, ShipPickGrid } from './ShipPickCard';

interface Ship {
  id: string;
  name: string;
  count: number;
  isStationary?: boolean;
  role?: string | null;
  unlockedMissions?: string[];
  flagshipImageIndex?: number;
  hullId?: string;
}

interface FleetCompositionProps {
  ships: Ship[];
  mission: Mission | null;
  selectedShips: Record<string, number>;
  onChange: (shipId: string, count: number) => void;
  onToggle: (shipId: string) => void;
}

function renderShipCard(
  ship: Ship,
  value: number,
  onChange: (shipId: string, count: number) => void,
  onToggle: (shipId: string) => void,
  disabled: boolean,
) {
  return (
    <ShipPickCard
      key={ship.id}
      shipId={ship.id}
      shipName={ship.name}
      available={ship.count}
      value={value}
      onChange={disabled ? () => {} : (c) => onChange(ship.id, c)}
      onToggle={() => onToggle(ship.id)}
      disabled={disabled}
      flagshipImageIndex={ship.flagshipImageIndex}
      hullId={ship.hullId}
    />
  );
}

export function FleetComposition({ ships, mission, selectedShips, onChange, onToggle }: FleetCompositionProps) {
  const { data: gameConfig } = useGameConfig();

  if (!mission) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Sélectionnez une mission pour voir les vaisseaux disponibles
      </div>
    );
  }

  const config = gameConfig?.missions[mission];
  const categorized: Record<ShipCategory, Ship[]> = { required: [], optional: [], disabled: [] };

  for (const ship of ships) {
    if (ship.count === 0) continue;
    const category = categorizeShip(ship.id, ship.count, gameConfig?.missions[mission], { isStationary: ship.isStationary, role: ship.role, unlockedMissions: ship.unlockedMissions }, mission);
    categorized[category].push(ship);
  }

  const sectionLabel = config?.requiredShipRoles ? '★ Requis' : '★ Recommandés';
  const showRequired = categorized.required.length > 0;

  return (
    <div className="space-y-3">
      {showRequired && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{sectionLabel}</div>
          <ShipPickGrid>
            {categorized.required.map((ship) =>
              renderShipCard(ship, selectedShips[ship.id] ?? 0, onChange, onToggle, false),
            )}
          </ShipPickGrid>
        </div>
      )}

      {categorized.optional.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Optionnels</div>
          <ShipPickGrid>
            {categorized.optional.map((ship) =>
              renderShipCard(ship, selectedShips[ship.id] ?? 0, onChange, onToggle, false),
            )}
          </ShipPickGrid>
        </div>
      )}

      {categorized.disabled.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Non disponibles</div>
          <ShipPickGrid>
            {categorized.disabled.map((ship) =>
              renderShipCard(ship, selectedShips[ship.id] ?? 0, onChange, onToggle, true),
            )}
          </ShipPickGrid>
        </div>
      )}
    </div>
  );
}
