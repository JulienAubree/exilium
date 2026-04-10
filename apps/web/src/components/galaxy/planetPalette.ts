/**
 * Shared palette for galaxy planet visuals.
 *
 * Single source of truth for planet class gradients, relation aura colors,
 * and belt debris color. Imported by PlanetDot (ribbon / detail), SlotMarker
 * (orbital canvas), and Ribbon (inline belt mini marker).
 *
 * Do NOT change values without coordinating with all consumers — these map
 * to planet class IDs from the API (volcanic, arid, temperate, glacial,
 * gaseous, homeworld) with an `unknown` fallback.
 */

export interface PlanetTypeColors {
  from: string;
  to: string;
  accent: string;
}

export const TYPE_COLORS: Record<string, PlanetTypeColors> = {
  volcanic:  { from: '#ef4444', to: '#f97316', accent: '#fbbf24' },
  arid:      { from: '#d97706', to: '#92400e', accent: '#fbbf24' },
  temperate: { from: '#22c55e', to: '#3b82f6', accent: '#86efac' },
  glacial:   { from: '#93c5fd', to: '#e0f2fe', accent: '#ffffff' },
  gaseous:   { from: '#a855f7', to: '#ec4899', accent: '#e879f9' },
  homeworld: { from: '#22d3ee', to: '#10b981', accent: '#a7f3d0' },
  unknown:   { from: '#52525b', to: '#27272a', accent: '#a1a1aa' },
};

export type PlanetAura = 'mine' | 'ally' | 'enemy';

export const AURA_COLORS: Record<PlanetAura, string> = {
  mine:  '#67e8f9', // cyan
  ally:  '#60a5fa', // blue
  enemy: '#f87171', // red
};

export const BELT_DEBRIS_COLOR = '#fb923c';
