import { useCallback, useState } from 'react';

/**
 * Hook utilitaire pour gérer un état d'ouverture/fermeture (modals,
 * dialogues, dropdowns, overlays). Remplace le pattern répété :
 *   const [isOpen, setIsOpen] = useState(false);
 *
 * Usage :
 *   const dialog = useDisclosure();
 *   <Button onClick={dialog.open}>Ouvrir</Button>
 *   <Modal open={dialog.isOpen} onClose={dialog.close}>…</Modal>
 */
export function useDisclosure(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return { isOpen, open, close, toggle, setIsOpen };
}
