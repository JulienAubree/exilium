import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialogA11y } from '@/hooks/useDialogA11y';

interface EntityDetailOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function EntityDetailOverlay({ open, onClose, title, children }: EntityDetailOverlayProps) {
  const { dialogProps, titleId } = useDialogA11y(open, { title });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
      <div className="fixed inset-0 bg-black/60 animate-fade-in" onClick={onClose} />
      <div
        {...dialogProps}
        className={cn(
          'relative z-50 w-full overflow-y-auto shadow-lg',
          'max-h-[85vh] rounded-t-2xl animate-slide-up-sheet bg-surface-raised border-t border-white/10',
          'lg:max-w-2xl lg:max-h-[85vh] lg:rounded-lg lg:mx-4 lg:border lg:border-border lg:bg-card lg:animate-slide-up',
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          {children}
        </div>
      </div>
    </div>
  );
}
