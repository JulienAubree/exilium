import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Panneaux flottants de la Passerelle (shell RTS).
 * HUD permanent : Planète et Flotte sont ouverts par défaut, l'état est
 * persisté — le poste de commandement se rallume comme on l'a laissé.
 * Un seul panneau par côté. Desktop uniquement (masqués sous lg).
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

export const usePanelStore = create<PanelStore>()(
  persist(
    (set) => ({
      open: { planete: true, flotte: true },
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
    }),
    { name: 'exilium.panels' },
  ),
);
