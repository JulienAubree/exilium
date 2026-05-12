import { useEffect, useId, useRef } from 'react';

interface UseDialogA11yResult {
  /** Spread on the dialog container. Adds role/aria-modal + labelledby and a ref for focus trap. */
  dialogProps: {
    ref: React.MutableRefObject<HTMLDivElement | null>;
    role: 'dialog';
    'aria-modal': true;
    'aria-labelledby'?: string;
  };
  /** Apply this id to the dialog's visual title so screen readers announce it. */
  titleId: string;
}

/**
 * Accessibility plumbing shared by modal-like overlays:
 * - sets role="dialog" + aria-modal + aria-labelledby
 * - moves focus into the dialog on open (first focusable element, or the container)
 * - traps Tab inside the dialog
 * - restores focus to the element that opened the dialog on close
 *
 * Pair with an existing Escape handler — this hook does not own Escape, since
 * each caller already has its own onClose semantics (e.g. ConfirmDialog calls
 * onCancel, others call onClose).
 *
 * Usage:
 *   const { dialogProps, titleId } = useDialogA11y(open, { title: 'Annuler ?' });
 *   return (
 *     <div {...dialogProps}>
 *       <h3 id={titleId}>Annuler ?</h3>
 *       ...
 *     </div>
 *   );
 */
export function useDialogA11y(
  open: boolean,
  options?: { title?: string },
): UseDialogA11yResult {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const reactId = useId();
  const titleId = `dialog-title-${reactId}`;

  useEffect(() => {
    if (!open) return;

    // Remember the element that had focus before the dialog opened.
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog. Prefer the first focusable element; if none,
    // focus the dialog container itself (which must be tabbable — we apply
    // tabIndex={-1} via the ref-bound element so programmatic focus works).
    const node = dialogRef.current;
    if (node) {
      const focusable = node.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable) {
        focusable.focus();
      } else {
        node.setAttribute('tabindex', '-1');
        node.focus();
      }
    }

    // Focus trap: when Tab/Shift+Tab would leave the dialog, loop it back.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        // Nothing focusable inside; keep focus on the container.
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the originally focused element.
      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open]);

  return {
    dialogProps: {
      ref: dialogRef,
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': options?.title ? titleId : undefined,
    },
    titleId,
  };
}
