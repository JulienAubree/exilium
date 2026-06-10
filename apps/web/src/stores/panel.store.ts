import { create } from 'zustand';

/**
 * Panneaux flottants de la Passerelle (shell RTS, P1).
 * Réf : docs/proposals/2026-06-10-la-passerelle-rts-shell.md
 */
export type PanelId = 'flotte';

interface PanelStore {
  open: Partial<Record<PanelId, boolean>>;
  toggle: (id: PanelId) => void;
  close: (id: PanelId) => void;
  closeAll: () => void;
}

export const usePanelStore = create<PanelStore>((set) => ({
  open: {},
  toggle: (id) => set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),
  close: (id) => set((s) => ({ open: { ...s.open, [id]: false } })),
  closeAll: () => set({ open: {} }),
}));
