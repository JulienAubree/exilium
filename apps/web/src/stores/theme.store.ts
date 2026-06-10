import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Thèmes « lab » — refonte peau & âme S0 (Quart de nuit).
 * Le switcher n'est rendu que si VITE_THEME_LAB=1 (build staging) ; le thème
 * lui-même est strictement additif (classe .theme-quart sur <html>).
 * Réf : docs/plans/2026-06-10-quart-de-nuit-s0.md
 */
export type ThemeId = 'default' | 'quart';
export type EmpireDisplay = 'cards' | 'table' | null;

export const themeLabEnabled = import.meta.env.VITE_THEME_LAB === '1';

interface ThemeState {
  theme: ThemeId;
  /** Vue du home Empire (desktop). null = auto : table sous quart, cartes sinon. */
  empireDisplay: EmpireDisplay;
  setTheme: (theme: ThemeId) => void;
  setEmpireDisplay: (display: Exclude<EmpireDisplay, null>) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'default',
      empireDisplay: null,
      setTheme: (theme) => set({ theme }),
      setEmpireDisplay: (empireDisplay) => set({ empireDisplay }),
    }),
    { name: 'exilium-theme' },
  ),
);

/** Le thème quart n'est actif que si le lab est ouvert (flag de build). */
export function useIsQuart(): boolean {
  const theme = useThemeStore((s) => s.theme);
  return themeLabEnabled && theme === 'quart';
}
