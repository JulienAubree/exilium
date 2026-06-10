import { create } from 'zustand';

/**
 * Panneaux flottants de la Passerelle (shell RTS, P1-P3).
 * Un seul panneau ouvert par côté : en ouvrir un ferme son voisin.
 * Réf : docs/proposals/2026-06-10-la-passerelle-rts-shell.md
 */
export type PanelId = 'planete' | 'flotte' | 'empire';

export const PANEL_SIDE: Record<PanelId, 'left' | 'right'> = {
  planete: 'left',
  flotte: 'right',
  empire: 'right',
};

interface PanelStore {
  open: Partial<Record<PanelId, boolean>>;
  toggle: (id: PanelId) => void;
  close: (id: PanelId) => void;
  closeAll: () => void;
}

export const usePanelStore = create<PanelStore>((set) => ({
  open: {},
  toggle: (id) =>
    set((s) => {
      const willOpen = !s.open[id];
      const next: Partial<Record<PanelId, boolean>> = { ...s.open, [id]: willOpen };
      if (willOpen) {
        for (const other of Object.keys(PANEL_SIDE) as PanelId[]) {
          if (other !== id && PANEL_SIDE[other] === PANEL_SIDE[id]) next[other] = false;
        }
      }
      return { open: next };
    }),
  close: (id) => set((s) => ({ open: { ...s.open, [id]: false } })),
  closeAll: () => set({ open: {} }),
}));
