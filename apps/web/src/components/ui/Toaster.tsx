import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useToastStore, type ToastVariant } from '@/stores/toast.store';
import { usePlanetStore } from '@/stores/planet.store';
import { cn } from '@/lib/utils';

const TOAST_DURATION_MS = 5000;

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-green-500/30 bg-green-950/50',
  error: 'border-destructive/30 bg-red-950/50',
  info: 'border-primary/30 bg-card',
  warning: 'border-energy/30 bg-yellow-950/50',
};

const variantIcons: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

function ToastItem({ id, message, variant, link, planetId }: { id: string; message: string; variant: ToastVariant; createdAt: number; link?: string; planetId?: string }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const navigate = useNavigate();
  const [paused, setPaused] = useState(false);

  // Auto-dismiss countdown: tracks remaining time and is paused on hover/focus.
  const remainingRef = useRef(TOAST_DURATION_MS);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return;
    startedAtRef.current = Date.now();
    const timeout = window.setTimeout(() => removeToast(id), remainingRef.current);
    return () => {
      window.clearTimeout(timeout);
      if (startedAtRef.current !== null) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
      }
    };
  }, [paused, id, removeToast]);

  // Errors are announced assertively (interrupting the SR queue) so the player
  // hears them immediately; everything else is polite.
  const role = variant === 'error' ? 'alert' : 'status';
  const ariaLive = variant === 'error' ? 'assertive' : 'polite';

  const handleActivate = () => {
    removeToast(id);
    if (planetId) usePlanetStore.getState().setActivePlanet(planetId);
    if (link) navigate(link);
  };

  // Rendered as <button> when an action is bound (link/planet), otherwise as a
  // non-interactive container so the toast doesn't claim a clickable role for
  // pure info messages.
  const isInteractive = !!link || !!planetId;

  if (!isInteractive) {
    return (
      <div
        role={role}
        aria-live={ariaLive}
        className={cn(
          'relative max-w-sm overflow-hidden rounded-md border px-4 py-3 text-sm shadow-lg animate-slide-in-right',
          variantStyles[variant],
        )}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        tabIndex={0}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs" aria-hidden>{variantIcons[variant]}</span>
          <span>{message}</span>
        </div>
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-foreground/20"
          style={{
            width: '100%',
            animation: `toast-progress ${TOAST_DURATION_MS}ms linear forwards`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      </div>
    );
  }

  return (
    <div role={role} aria-live={ariaLive}>
      <button
        type="button"
        className={cn(
          'relative block w-full max-w-sm cursor-pointer overflow-hidden rounded-md border px-4 py-3 text-left text-sm shadow-lg animate-slide-in-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variantStyles[variant],
        )}
        onClick={handleActivate}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs" aria-hidden>{variantIcons[variant]}</span>
          <span>{message}</span>
        </div>
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-foreground/20"
          style={{
            width: '100%',
            animation: `toast-progress ${TOAST_DURATION_MS}ms linear forwards`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-20 right-2 left-2 sm:left-auto sm:right-4 sm:bottom-16 lg:bottom-16 z-50 flex flex-col gap-2 items-end"
    >
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}
