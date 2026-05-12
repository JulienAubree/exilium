/**
 * Tokens centralisés pour les raretés (modules, biomes, drops, etc.).
 * Source de vérité unique pour les couleurs, labels et style classes.
 *
 * Utilisé par <RarityBadge> mais aussi disponible pour les
 * compositions custom (ex: barre de progression colorée selon rareté).
 */

export type Rarity = 'common' | 'rare' | 'epic';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
};

/** Couleurs texte pour la rareté (palette Tailwind du projet). */
export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
};

/** Style complet badge : border + bg + text. */
export const RARITY_BADGE: Record<Rarity, string> = {
  common: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
  rare: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  epic: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
};

/** Dot color (utile pour un indicateur compact). */
export const RARITY_DOT: Record<Rarity, string> = {
  common: 'bg-slate-400',
  rare: 'bg-sky-400',
  epic: 'bg-violet-400',
};
