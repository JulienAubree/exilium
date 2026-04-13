import { create } from 'zustand';

type SheetType = 'empire' | 'planete' | 'production' | 'espace' | 'social' | null;

interface UIState {
  activeSheet: SheetType;
  openSheet: (sheet: Exclude<SheetType, null>) => void;
  closeSheet: () => void;
  toggleSheet: (sheet: Exclude<SheetType, null>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeSheet: null,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  toggleSheet: (sheet) => set((s) => ({ activeSheet: s.activeSheet === sheet ? null : sheet })),
}));
