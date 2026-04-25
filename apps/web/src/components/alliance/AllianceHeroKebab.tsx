import { useRef, useState } from 'react';
import { MoreIcon } from '@/lib/icons';
import { useOutsideClick } from '@/hooks/useOutsideClick';

interface AllianceHeroKebabProps {
  onLeave: () => void;
}

export function AllianceHeroKebab({ onLeave }: AllianceHeroKebabProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Plus d'actions"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        <MoreIcon width={18} height={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-sm px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            onClick={() => { setOpen(false); onLeave(); }}
          >
            Quitter l'alliance
          </button>
        </div>
      )}
    </div>
  );
}
