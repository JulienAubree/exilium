import React from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { GameImage } from '@/components/common/GameImage';
import { cn } from '@/lib/utils';

export interface ShipData {
  id: string;
  name: string;
  count: number;
  categoryId?: string;
}

interface ShipCategoryGridProps {
  ships: ShipData[];
  /** If true, hide ships with count 0 */
  hideEmpty?: boolean;
  /** Render custom content below ship name (e.g., quantity input) */
  renderActions?: (ship: ShipData) => React.ReactNode;
  /** Click handler for a ship card */
  onShipClick?: (shipId: string) => void;
  /** Set of ship IDs that are currently selected (adds visual styling) */
  selectedIds?: Set<string>;
}

const CATEGORY_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  ship_combat: {
    color: 'text-red-400',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  ship_transport: {
    color: 'text-blue-400',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
  },
  ship_utilitaire: {
    color: 'text-emerald-400',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
  },
};

export function ShipCategoryGrid({
  ships,
  hideEmpty = false,
  renderActions,
  onShipClick,
  selectedIds,
}: ShipCategoryGridProps) {
  const { data: gameConfig } = useGameConfig();

  const shipCategories = (gameConfig?.categories ?? [])
    .filter((c) => c.entityType === 'ship')
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      {shipCategories.map((category) => {
        const categoryShips = ships.filter((ship) => {
          const catId = ship.categoryId ?? gameConfig?.ships[ship.id]?.categoryId;
          return catId === category.id;
        });

        const visibleShips = hideEmpty
          ? categoryShips.filter((s) => s.count > 0)
          : categoryShips;

        if (visibleShips.length === 0) return null;

        const style = CATEGORY_STYLES[category.id];

        return (
          <div key={category.id}>
            <div className="flex items-center gap-1.5 mb-2">
              {style && (
                <span className={style.color}>{style.icon}</span>
              )}
              <span className={`text-xs font-semibold uppercase tracking-wider ${style?.color ?? 'text-muted-foreground'}`}>
                {category.name}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
              {visibleShips.map((ship) => {
                const isClickable = !!onShipClick;
                const isSelected = selectedIds?.has(ship.id) ?? false;
                const Tag = isClickable ? 'button' : 'div';

                return (
                  <Tag
                    key={ship.id}
                    {...(isClickable
                      ? { onClick: () => onShipClick(ship.id), type: 'button' }
                      : {})}
                    className={cn(
                      'retro-card overflow-hidden flex flex-col text-left',
                      isSelected && 'border-primary',
                      isClickable && 'cursor-pointer',
                    )}
                  >
                    <div className="relative h-24 overflow-hidden">
                      <GameImage
                        category="ships"
                        id={ship.id}
                        size="full"
                        alt={ship.name}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
                        x{ship.count.toLocaleString()}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-md">
                          <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 flex flex-col gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground leading-tight line-clamp-2">
                        {ship.name}
                      </span>
                      {renderActions && renderActions(ship)}
                    </div>
                  </Tag>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
