/**
 * Tokens centralisés pour les raretés (modules, biomes, drops, etc.).
 * Source de vérité unique pour les couleurs, labels et style classes.
 *
 * Les raretés modules utilisent 3 niveaux (`common/rare/epic`), les
 * raretés biomes 5 niveaux (`common/uncommon/rare/epic/legendary`).
 * Tous les dicts ci-dessous couvrent les 5 raretés — les composants
 * qui ne consomment que les modules peuvent typer plus strictement
 * avec `ModuleRarity`.
 *
 * Utilisé par <RarityBadge> mais aussi disponible pour les
 * compositions custom (ex: barre de progression colorée selon rareté).
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Sous-ensemble des raretés utilisé pour les modules (3 niveaux). */
export type ModuleRarity = 'common' | 'rare' | 'epic';

/** Typage élargi pour accepter les `rarity: string` runtime (cf. RARITY_HEX). */
export const RARITY_LABEL: Record<string, string> = {
  common: 'Commun',
  uncommon: 'Inhabituel',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
};

/** Couleurs texte pour la rareté (palette Tailwind du projet). */
export const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-slate-300',
  uncommon: 'text-emerald-300',
  rare: 'text-sky-300',
  epic: 'text-violet-300',
  legendary: 'text-amber-300',
};

/** Style complet badge : border + bg + text. */
export const RARITY_BADGE: Record<Rarity, string> = {
  common: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
  uncommon: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  rare: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  epic: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
  legendary: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
};

/** Dot color (utile pour un indicateur compact, contexte sombre). */
export const RARITY_DOT: Record<Rarity, string> = {
  common: 'bg-slate-400',
  uncommon: 'bg-emerald-400',
  rare: 'bg-sky-400',
  epic: 'bg-violet-400',
  legendary: 'bg-amber-400',
};

/**
 * Couleurs hex (pour styles inline `backgroundColor: ...`, ex: pastilles
 * biomes). Typage élargi en `Record<string, string>` pour accepter les
 * valeurs runtime non typées (ex: `biome.rarity` qui vient d'une API)
 * — fallback `#9ca3af` côté caller.
 */
export const RARITY_HEX: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#eab308',
};
