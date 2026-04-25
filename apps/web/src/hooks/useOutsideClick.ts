import { useEffect, type RefObject } from 'react';

/**
 * Ferme un panneau (dropdown, popover, modal) quand l'utilisateur clique
 * en dehors de l'élément référencé. Auto-cleanup quand `isOpen` passe à false.
 */
export function useOutsideClick(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onOutsideClick: () => void,
) {
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutsideClick();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, isOpen, onOutsideClick]);
}
