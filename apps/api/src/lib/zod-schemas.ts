import { z } from 'zod';

/**
 * Schémas Zod réutilisables pour réduire la duplication dans les routers tRPC.
 * Les patterns les plus fréquents sont déclarés ici une seule fois.
 *
 * Chaque schéma reste un `z.ZodSchema` — on peut chaîner `.optional()`,
 * `.nullable()`, `.default()`, etc. en cas de besoin.
 *
 * Note : ce fichier ne contient que des schémas réellement consommés. Une
 * première série de helpers de pré-requis (`buildingPrereqSchema`,
 * `researchPrereqSchema`, `mixedPrereqSchema`) et leurs dépendances avaient
 * été écrites lors du « chantier 4 — partie 1 » (8d39c0a3) mais la partie 2,
 * qui devait les brancher, n'a jamais eu lieu. Elles ne décrivaient d'ailleurs
 * pas le format réellement envoyé par l'admin, et ont été retirées.
 */

// ── Strings ──────────────────────────────────────────────────────────

/** ID non-vide (clé primaire, identifiant entité) */
export const idSchema = z.string().min(1);

/** Chaîne non vide (label, titre, description requise) */
export const nonEmptyString = z.string().min(1);

/** Chaîne nullable et optionnelle (champ texte qui peut être effacé) */
export const optionalNullableString = z.string().nullable().optional();

// ── Numbers ──────────────────────────────────────────────────────────

/** Entier ≥ 0 (coûts, durées, etc.) */
export const nonNegativeInt = z.number().int().min(0);

/** Entier optionnel (champ admin facultatif) */
export const optionalInt = z.number().int().optional();

/** Entier nullable et optionnel (max par planète, etc.) */
export const optionalNullableInt = z.number().int().nullable().optional();

// ── Domain-specific (jeu) ────────────────────────────────────────────

/** Profil d'arme (batterie multiple) */
export const weaponProfileSchema = z.object({
  damage: z.number(),
  shots: nonNegativeInt,
  targetCategory: nonEmptyString,
  rafale: z.object({ category: nonEmptyString, count: nonNegativeInt }).optional(),
  hasChainKill: z.boolean().optional(),
});
