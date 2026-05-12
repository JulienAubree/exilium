import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Texte explicatif. Alias `message` accepté pour rétro-compatibilité. */
  description?: string;
  /** @deprecated utiliser `description`. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Style destructive (rouge). Alias `danger` accepté pour rétro-compat. */
  variant?: 'default' | 'destructive';
  /** @deprecated utiliser `variant="destructive"`. */
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  variant,
  danger = false,
}: ConfirmDialogProps) {
  // Harmonise l'API avec web/components/common/ConfirmDialog :
  // `description` est privilégié, `message` reste accepté.
  const text = description ?? message ?? '';
  const isDanger = variant === 'destructive' || danger;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
      <div
        ref={dialogRef}
        className="admin-card p-6 max-w-md w-full mx-4 animate-slide-up shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded ${isDanger ? 'bg-red-900/30' : 'bg-hull-900/30'}`}>
            <AlertTriangle className={`w-5 h-5 ${isDanger ? 'text-red-400' : 'text-hull-400'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-100">{title}</h3>
            {text && <p className="mt-1 text-sm text-gray-400">{text}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="admin-btn-ghost">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={isDanger ? 'admin-btn-danger' : 'admin-btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
