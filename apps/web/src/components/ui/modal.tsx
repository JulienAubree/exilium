import { type ReactNode, type HTMLAttributes, useEffect, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { useDialogA11y } from '@/hooks/useDialogA11y';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Classe(s) supplémentaire(s) appliquée(s) au backdrop (par-dessus `bg-black/60`). */
  backdropClassName?: string;
  /** Si false, l'ESC ne ferme pas la modal (utile pour les modales bloquantes type onboarding). */
  closeOnEsc?: boolean;
  /** Si false, le clic sur le backdrop ne ferme pas la modal. */
  closeOnBackdropClick?: boolean;
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      children,
      title,
      className,
      backdropClassName,
      closeOnEsc = true,
      closeOnBackdropClick = true,
      ...props
    },
    ref,
  ) => {
    const { dialogProps, titleId } = useDialogA11y(open, { title });
    const setRefs = (node: HTMLDivElement | null) => {
      (dialogProps.ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    };

    useEffect(() => {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEsc) onClose();
      };
      if (open) {
        document.addEventListener('keydown', handleEsc);
        document.body.style.overflow = 'hidden';
      }
      return () => {
        document.removeEventListener('keydown', handleEsc);
        document.body.style.overflow = '';
      };
    }, [open, onClose, closeOnEsc]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
        <div
          className={cn('fixed inset-0 bg-black/60', backdropClassName)}
          onClick={closeOnBackdropClick ? onClose : undefined}
        />
        <div
          role={dialogProps.role}
          aria-modal={dialogProps['aria-modal']}
          aria-labelledby={dialogProps['aria-labelledby']}
          ref={setRefs}
          className={cn(
            'relative z-50 w-full max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-safe-bottom shadow-lg animate-slide-up-sheet',
            'lg:max-w-lg lg:rounded-lg lg:animate-fade-in lg:pb-6',
            className,
          )}
          {...props}
        >
          {title && <h2 id={titleId} className="mb-4 text-lg font-semibold text-foreground">{title}</h2>}
          {children}
        </div>
      </div>
    );
  },
);
Modal.displayName = 'Modal';

export { Modal };
