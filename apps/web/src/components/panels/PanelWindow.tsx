import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Fenêtre flottante de la Passerelle : cadre commun des panneaux.
 * Desktop : fenêtre ancrée à droite ; mobile : feuille plein écran.
 */
export function PanelWindow({ title, icon, shortcut, onClose, children, className }: {
  title: string;
  icon?: ReactNode;
  /** Raccourci affiché dans l'en-tête (ex. « F »). */
  shortcut?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="dialog"
      aria-label={title}
      className={cn(
        'fixed z-40 flex flex-col overflow-hidden rounded-t-2xl border border-border bg-surface-raised shadow-raised animate-slide-up',
        'inset-x-0 bottom-0 top-24',
        'lg:inset-auto lg:right-16 lg:top-16 lg:bottom-4 lg:w-[420px] lg:rounded-lg',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2">
          {shortcut && (
            <kbd className="hidden lg:inline rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              {shortcut}
            </kbd>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}
