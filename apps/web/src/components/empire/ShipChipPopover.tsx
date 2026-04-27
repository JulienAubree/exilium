import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAssetUrl } from '@/lib/assets';

interface Props {
  shipId: string;
  name: string;
  count: number;
  cargoCapacity: number;
  role?: string | null;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.floor(value));
}

export function ShipChipPopover({ shipId, name, count, cargoCapacity, role }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 220;
      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      if (left + popoverWidth > window.innerWidth - 8) left = window.innerWidth - popoverWidth - 8;
      if (left < 8) left = 8;
      setCoords({ top: rect.bottom + 6, left });
    }
    setIsOpen(true);
  };

  const handleLeave = () => {
    setIsOpen(false);
    setCoords(null);
  };

  const totalCargo = count * cargoCapacity;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        tabIndex={0}
        className="flex items-center gap-1.5 rounded bg-background/40 px-1.5 py-1 cursor-help focus:outline-none focus:ring-1 focus:ring-primary/40"
        title={`${count.toLocaleString('fr-FR')} ${name}`}
      >
        <img
          src={getAssetUrl('ships', shipId, 'thumb')}
          alt=""
          className="h-4 w-4 rounded-sm object-cover shrink-0"
          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
        />
        <span className="font-mono text-[11px] font-semibold text-foreground">{count.toLocaleString('fr-FR')}</span>
      </div>
      {isOpen && coords && createPortal(
        <div
          className="fixed w-[220px] rounded-lg border border-border bg-popover/95 backdrop-blur-md p-3 shadow-xl pointer-events-none"
          style={{ top: coords.top, left: coords.left, zIndex: 9999 }}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <img
              src={getAssetUrl('ships', shipId, 'thumb')}
              alt=""
              className="h-10 w-10 rounded-md object-cover border border-border/60 shrink-0"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{name}</div>
              {role && <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{role}</div>}
            </div>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stationnés</span>
              <span className="font-mono font-semibold text-foreground">{count.toLocaleString('fr-FR')}</span>
            </div>
            {cargoCapacity > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cargo cumulé</span>
                <span className="font-mono text-foreground">{formatCompact(totalCargo)}</span>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
