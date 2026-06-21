/**
 * Édits & Politiques d'Empire — formules pures (chantier Empire §5.2).
 * Spec : docs/plans/2026-06-21-edits-politiques-empire.md
 *
 * Une posture = un gain franc contre un malus franc (pas de choix gratuit).
 * Le nombre de postures non-neutres activables = capacité dérivée du niveau
 * d'empire (cf. empirePolicyCapacity). Les effets s'empilent et se branchent
 * sur l'infra existante (buildBonusContext pour la prod, malus de
 * construction pour le temps, getFleetSlots, gains d'exilium).
 */

export interface PolicyEffects {
  /** Delta additif sur les trois productions (ex. +0.12 / −0.12). */
  productionDelta: number;
  /** Multiplicateur sur les gains d'exilium (1 = neutre). */
  exiliumGainMult: number;
  /** Multiplicateurs de temps de construction par catégorie (1 = neutre). */
  buildTimeMult: { building: number; ship: number; defense: number };
  /** Bonus additif de slots de flotte simultanés. */
  fleetSlotBonus: number;
}

export interface PolicyPosture {
  id: string;
  label: string;
  description: string;
  /** Effets de la posture (partiels — le reste est neutre). */
  effects: Partial<Omit<PolicyEffects, 'buildTimeMult'>> & {
    buildTimeMult?: Partial<PolicyEffects['buildTimeMult']>;
  };
}

export interface PolicyAxis {
  id: string;
  label: string;
  description: string;
  postures: PolicyPosture[];
}

export function neutralPolicyEffects(): PolicyEffects {
  return {
    productionDelta: 0,
    exiliumGainMult: 1,
    buildTimeMult: { building: 1, ship: 1, defense: 1 },
    fleetSlotBonus: 0,
  };
}

/**
 * Catalogue des axes/postures (versionné, source de vérité). Les magnitudes
 * sont les valeurs de départ — équilibrables ici. `neutre` est implicite
 * (absence de posture = aucun effet) et n'est pas listé.
 */
export const POLICY_AXES: PolicyAxis[] = [
  {
    id: 'doctrine',
    label: 'Doctrine économique',
    description: 'Arbitre entre croissance civile et effort de guerre.',
    postures: [
      {
        id: 'croissance',
        label: 'Croissance',
        description: '+12 % production · construction militaire ralentie (+12 %).',
        effects: { productionDelta: 0.12, buildTimeMult: { ship: 1.12, defense: 1.12 } },
      },
      {
        id: 'economie_guerre',
        label: 'Économie de guerre',
        description: 'Construction militaire accélérée (−18 %) · −12 % production.',
        effects: { productionDelta: -0.12, buildTimeMult: { ship: 0.82, defense: 0.82 } },
      },
    ],
  },
  {
    id: 'fiscalite',
    label: 'Fiscalité',
    description: 'Arbitre entre rendement immédiat et trésor d’exilium.',
    postures: [
      {
        id: 'rendement',
        label: 'Rendement',
        description: '+10 % production · −10 % gains d’exilium.',
        effects: { productionDelta: 0.1, exiliumGainMult: 0.9 },
      },
      {
        id: 'frugalite',
        label: 'Frugalité',
        description: '+15 % gains d’exilium · −8 % production.',
        effects: { productionDelta: -0.08, exiliumGainMult: 1.15 },
      },
    ],
  },
  {
    id: 'logistique',
    label: 'Logistique',
    description: 'Arbitre entre projection de flotte et cadence industrielle.',
    postures: [
      {
        id: 'mobilisation',
        label: 'Mobilisation',
        description: '+1 slot de flotte · construction de bâtiments ralentie (+10 %).',
        effects: { fleetSlotBonus: 1, buildTimeMult: { building: 1.1 } },
      },
      {
        id: 'industrialisation',
        label: 'Industrialisation',
        description: 'Bâtiments construits plus vite (−18 %) · −5 % production.',
        effects: { productionDelta: -0.05, buildTimeMult: { building: 0.82 } },
      },
    ],
  },
];

const AXIS_BY_ID = new Map(POLICY_AXES.map((a) => [a.id, a]));

export function isPolicyAxis(value: unknown): value is string {
  return typeof value === 'string' && AXIS_BY_ID.has(value);
}

export function isPolicyPosture(axisId: string, postureId: unknown): boolean {
  const axis = AXIS_BY_ID.get(axisId);
  return !!axis && typeof postureId === 'string' && axis.postures.some((p) => p.id === postureId);
}

/**
 * Combine les postures actives en effets globaux. `active` = { axisId: postureId }.
 * Les axes/postures inconnus sont ignorés (robustesse aux configs obsolètes).
 * Production = somme additive ; exilium & temps = produits ; slots = somme.
 */
export function policyEffects(active: Record<string, string> | null | undefined): PolicyEffects {
  const out = neutralPolicyEffects();
  if (!active) return out;

  for (const [axisId, postureId] of Object.entries(active)) {
    const axis = AXIS_BY_ID.get(axisId);
    if (!axis) continue;
    const posture = axis.postures.find((p) => p.id === postureId);
    if (!posture) continue;
    const e = posture.effects;

    if (e.productionDelta) out.productionDelta += e.productionDelta;
    if (e.exiliumGainMult != null) out.exiliumGainMult *= e.exiliumGainMult;
    if (e.fleetSlotBonus) out.fleetSlotBonus += e.fleetSlotBonus;
    if (e.buildTimeMult) {
      if (e.buildTimeMult.building != null) out.buildTimeMult.building *= e.buildTimeMult.building;
      if (e.buildTimeMult.ship != null) out.buildTimeMult.ship *= e.buildTimeMult.ship;
      if (e.buildTimeMult.defense != null) out.buildTimeMult.defense *= e.buildTimeMult.defense;
    }
  }

  return out;
}

/** Nombre de postures non-neutres activables, plafonné au nombre d'axes. */
export function empirePolicyCapacity(
  empireLevel: number,
  universe: Record<string, unknown>,
): number {
  const perSlot = Number(universe.empire_policy_levels_per_slot) || 10;
  const base = 1 + Math.floor(Math.max(0, empireLevel - 1) / perSlot);
  return Math.min(base, POLICY_AXES.length);
}

/** Compte les postures non-neutres dans une sélection. */
export function countActivePolicies(active: Record<string, string> | null | undefined): number {
  if (!active) return 0;
  let n = 0;
  for (const [axisId, postureId] of Object.entries(active)) {
    if (isPolicyPosture(axisId, postureId)) n++;
  }
  return n;
}
