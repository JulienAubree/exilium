/**
 * Gouverneurs v1 — délégation par directive (chantier Empire §5.3).
 * Le gouverneur propose la prochaine construction quand la file est libre :
 * priorités intégrées (« bons défauts ») puis logique de la directive.
 * Pure : le serveur vérifie l'affordabilité et lance via building.service.
 */

export const GOVERNOR_DIRECTIVES = ['extraction'] as const;
export type GovernorDirective = (typeof GOVERNOR_DIRECTIVES)[number];

export interface GovernorContext {
  /** Niveaux actuels par buildingId. */
  levels: Record<string, number>;
  /** Bilan énergétique (production − consommation). */
  energyBalance: number;
  /** Remplissage des stocks (0..1) par ressource. */
  storageFill: { minerai: number; silicium: number; hydrogene: number };
  /** Ids résolus par rôle (config). */
  roles: {
    producerMinerai: string;
    producerSilicium: string;
    producerHydrogene: string;
    producerEnergy: string;
    storageMinerai: string;
    storageSilicium: string;
    storageHydrogene: string;
  };
}

/**
 * Candidats de construction, par ordre de priorité.
 * 1. Déficit d'énergie → centrale.
 * 2. Stock saturé (>95 %) → l'entrepôt correspondant (le plus saturé d'abord).
 * 3. Directive extraction → la mine la plus basse (égalité : minerai > silicium > hydrogène).
 */
export function governorCandidates(
  directive: GovernorDirective,
  ctx: GovernorContext,
): string[] {
  const out: string[] = [];
  const { roles, levels } = ctx;

  if (ctx.energyBalance < 0) out.push(roles.producerEnergy);

  const storages: Array<[number, string]> = [
    [ctx.storageFill.minerai, roles.storageMinerai],
    [ctx.storageFill.silicium, roles.storageSilicium],
    [ctx.storageFill.hydrogene, roles.storageHydrogene],
  ];
  for (const [fill, id] of storages.sort((a, b) => b[0] - a[0])) {
    if (fill > 0.95) out.push(id);
  }

  if (directive === 'extraction') {
    const mines: Array<[number, string]> = [
      [levels[roles.producerMinerai] ?? 0, roles.producerMinerai],
      [levels[roles.producerSilicium] ?? 0, roles.producerSilicium],
      [levels[roles.producerHydrogene] ?? 0, roles.producerHydrogene],
    ];
    mines.sort((a, b) => a[0] - b[0]);
    for (const [, id] of mines) out.push(id);
  }

  return [...new Set(out)];
}

export function isGovernorDirective(value: unknown): value is GovernorDirective {
  return typeof value === 'string' && (GOVERNOR_DIRECTIVES as readonly string[]).includes(value);
}
