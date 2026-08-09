/**
 * ============================================================================
 * LE CYCLE D'UN SYSTÈME DES PREMIERS
 * ============================================================================
 *
 * ```
 *   tenu ──(garnison entamée)──> contesté ──(garnison à zéro)──> libéré
 *     ^                                                             │
 *     └──────────────── returnsAt atteint ◀──── windowEndsAt ───────┘
 * ```
 *
 * Reprendre un système ouvre une FENÊTRE — bonus d'empire et/ou gisements
 * exceptionnels — puis les Premiers reviennent.
 *
 * **Le retour n'est pas un échec de conception.** C'est le moteur : il rend le
 * rendez-vous du groupe structurellement répétable, et il empêche la carte de
 * se « finir », ce qui serait contradictoire avec un monde persistant. Un
 * système repris pour toujours est un système dont on ne reparle plus.
 *
 * Tout est pur ici : pas de base, pas d'horloge implicite. `now` est toujours
 * passé, pour que les tests fixent le temps et que le comportement soit le même
 * côté serveur, côté cron et côté affichage.
 */

/** Réglages du cycle, issus de `universe_config`. */
export interface PremierCycleConfig {
  /** Durée de la fenêtre de bonus après la libération, en heures. */
  windowHours: number;
  /** Délai avant le retour des Premiers, en heures, compté depuis la libération. */
  returnHours: number;
}

export const DEFAULT_PREMIER_CYCLE: PremierCycleConfig = {
  windowHours: 48,
  returnHours: 168,
};

/**
 * Construit la config du cycle depuis les clés d'univers, avec des replis.
 *
 * Les valeurs par défaut — 48 h de fenêtre, retour à 7 jours — donnent au
 * groupe deux jours pour exploiter sa prise et une semaine de répit. Elles
 * sont un point de départ à régler en jouant, pas une vérité : c'est
 * exactement le genre de nombre qu'on ne peut pas deviner à la table.
 */
export function buildPremierCycleConfig(universe: Record<string, unknown>): PremierCycleConfig {
  const windowHours = Number(universe.premier_window_hours);
  const returnHours = Number(universe.premier_return_hours);
  return {
    windowHours: Number.isFinite(windowHours) && windowHours > 0 ? windowHours : DEFAULT_PREMIER_CYCLE.windowHours,
    returnHours: Number.isFinite(returnHours) && returnHours > 0 ? returnHours : DEFAULT_PREMIER_CYCLE.returnHours,
  };
}

/** Les échéances posées au moment où un système tombe. */
export interface CycleDeadlines {
  liberatedAt: Date;
  windowEndsAt: Date;
  returnsAt: Date;
}

/**
 * Pose les échéances d'un système qui vient d'être libéré.
 *
 * Les deux délais partent du MÊME instant (la libération) plutôt que de
 * s'enchaîner : la fenêtre est une récompense, le retour est une horloge, et
 * les faire dépendre l'un de l'autre rendrait le réglage de l'un dépendant de
 * l'autre. Si `returnHours` est plus court que `windowHours`, les Premiers
 * reviennent avant la fin de la fenêtre — c'est un réglage valide, agressif,
 * pas une incohérence à corriger.
 */
export function cycleDeadlines(liberatedAt: Date, config: PremierCycleConfig): CycleDeadlines {
  const h = 3600 * 1000;
  return {
    liberatedAt,
    windowEndsAt: new Date(liberatedAt.getTime() + config.windowHours * h),
    returnsAt: new Date(liberatedAt.getTime() + config.returnHours * h),
  };
}

/** L'état d'un système tel que la garnison et l'horloge le déterminent. */
export type PremierPhase =
  /** Aux Premiers, garnison intacte. */
  | 'held'
  /** Aux Premiers, garnison entamée — un assaut est en cours. */
  | 'contested'
  /** Repris, fenêtre de bonus active. */
  | 'liberated_active'
  /** Repris, fenêtre close : le système reste à nous mais ne rapporte plus. */
  | 'liberated_spent';

export interface PremierSystemLike {
  garrison: Record<string, number>;
  garrisonRemaining: Record<string, number>;
  liberatedAt: Date | null;
  windowEndsAt: Date | null;
  returnsAt: Date | null;
}

/** Somme des unités d'une garnison. */
export function garrisonSize(garrison: Record<string, number>): number {
  let total = 0;
  for (const n of Object.values(garrison)) total += n > 0 ? n : 0;
  return total;
}

/**
 * La phase d'un système, déduite de son état réel plutôt que d'une colonne
 * qu'on pourrait oublier de mettre à jour.
 *
 * Note : un système dont `returnsAt` est dépassé est rendu comme `held` ici,
 * même si la base porte encore `liberated`. La fonction dit la VÉRITÉ du
 * moment ; c'est au cron de retour de recomposer la garnison et de faire
 * concorder la base. Un affichage qui n'attend pas le cron montre donc déjà le
 * bon état.
 */
export function premierPhase(sys: PremierSystemLike, now: Date): PremierPhase {
  const repris = garrisonSize(sys.garrisonRemaining) === 0 && sys.liberatedAt !== null;

  if (repris) {
    if (sys.returnsAt && now >= sys.returnsAt) return 'held';
    if (sys.windowEndsAt && now >= sys.windowEndsAt) return 'liberated_spent';
    return 'liberated_active';
  }

  const plein = garrisonSize(sys.garrison);
  const reste = garrisonSize(sys.garrisonRemaining);
  return reste < plein ? 'contested' : 'held';
}

/** La fenêtre de bonus rapporte-t-elle en ce moment ? */
export function bonusActif(sys: PremierSystemLike, now: Date): boolean {
  return premierPhase(sys, now) === 'liberated_active';
}

/**
 * Part de la garnison déjà détruite, entre 0 et 1 — la barre de progression
 * d'un siège, pour que le groupe voie que ses assauts cumulent.
 */
export function progressionSiege(sys: PremierSystemLike): number {
  const plein = garrisonSize(sys.garrison);
  if (plein === 0) return 1;
  const reste = garrisonSize(sys.garrisonRemaining);
  return Math.min(1, Math.max(0, 1 - reste / plein));
}

/**
 * Retire des pertes de la garnison restante.
 *
 * Pur : le service décide quand écrire, la formule dit seulement ce que devient
 * la garnison. Les comptes ne descendent jamais sous zéro, et les entrées
 * vidées disparaissent — de sorte que `garrisonSize` à 0 signifie bien
 * « libéré » sans avoir à filtrer les zéros partout ailleurs.
 */
export function appliquerPertes(
  garrisonRemaining: Record<string, number>,
  pertes: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [shipId, n] of Object.entries(garrisonRemaining)) {
    const restant = n - (pertes[shipId] ?? 0);
    if (restant > 0) out[shipId] = restant;
  }
  return out;
}
