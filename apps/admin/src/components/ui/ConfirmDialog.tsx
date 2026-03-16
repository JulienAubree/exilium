import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
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
          <div className={`p-2 rounded ${danger ? 'bg-red-900/30' : 'bg-hull-900/30'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-hull-400'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-100">{title}</h3>
            <p className="mt-1 text-sm text-gray-400">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="admin-btn-ghost">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={danger ? 'admin-btn-danger' : 'admin-btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
