import { z } from 'zod';

/**
 * Schéma Zod du contenu administrable des missions d'exploration en
 * espace profond. Calque du `anomaly-content.types.ts` avec :
 *  - une notion de `sectors` (lieux narratifs abstraits)
 *  - des `events` avec gates étendus (research + shipRole + shipId)
 *  - de nouveaux outcomes (bonusBiomeReveal, triggerCombat,
 *    unlockAnomalyEngagement)
 *
 * Cf. spec docs/superpowers/specs/2026-05-11-deep-space-exploration-missions-design.md §1.2
 */

export const EXPEDITION_TIERS = ['early', 'mid', 'deep'] as const;
export type ExpeditionTier = (typeof EXPEDITION_TIERS)[number];

// ─── Requirements sur les choix ──────────────────────────────────────────

const requirementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('research'),
    researchId: z.string().min(1).max(64),
    minLevel: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('shipRole'),
    role: z.string().min(1).max(32),
    minCount: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('shipId'),
    shipId: z.string().min(1).max(64),
    minCount: z.number().int().min(1),
  }),
]);

export type ChoiceRequirement = z.infer<typeof requirementSchema>;

// ─── Combat ponctuel ─────────────────────────────────────────────────────

const combatSpecSchema = z.object({
  fp: z.number().int().min(1),
  loot: z.object({
    minerai: z.number().int().min(0).optional(),
    silicium: z.number().int().min(0).optional(),
    hydrogene: z.number().int().min(0).optional(),
  }).optional(),
  resolutionTextWin: z.string().max(500).default(''),
  resolutionTextLose: z.string().max(500).default(''),
});

// ─── Outcome d'un choix ──────────────────────────────────────────────────

const moduleDropSchema = z.object({
  rarity: z.enum(['common', 'rare', 'epic']),
  count: z.number().int().min(1).max(5).default(1),
});

const outcomeSchema = z.object({
  minerai: z.number().int().default(0),
  silicium: z.number().int().default(0),
  hydrogene: z.number().int().default(0),
  exilium: z.number().int().default(0),
  hullDelta: z.number().min(-1).max(1).default(0),
  moduleDrop: moduleDropSchema.optional(),
  bonusBiomeReveal: z.number().int().min(0).max(5).default(0),
  triggerCombat: combatSpecSchema.optional(),
  unlockAnomalyEngagement: z.object({
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }).optional(),
  resolutionText: z.string().max(500).default(''),
});

export type EventOutcome = z.infer<typeof outcomeSchema>;

// ─── Choix d'un événement ────────────────────────────────────────────────

const choiceSchema = z.object({
  label: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  tone: z.enum(['positive', 'negative', 'risky', 'neutral']).default('neutral'),
  hidden: z.boolean().default(false),
  requirements: z.array(requirementSchema).default([]),
  outcome: outcomeSchema,
  /** Si défini, appliqué quand les requirements ne sont pas remplies. */
  failureOutcome: outcomeSchema.optional(),
});

export type ExpeditionChoice = z.infer<typeof choiceSchema>;

// ─── Événement ───────────────────────────────────────────────────────────

const eventSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'id en kebab-case'),
  tier: z.enum(EXPEDITION_TIERS),
  title: z.string().min(1).max(120),
  description: z.string().max(1000),
  imageRef: z.string().max(500).optional(),
  weight: z.number().min(0).default(1),
  enabled: z.boolean().default(true),
  choices: z.array(choiceSchema).min(2).max(5),
});

export type ExpeditionEvent = z.infer<typeof eventSchema>;

// ─── Secteur narratif ────────────────────────────────────────────────────

const sectorSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'id en kebab-case'),
  name: z.string().min(1).max(120),
  tier: z.enum(EXPEDITION_TIERS),
  briefingTemplate: z.string().min(1).max(1000),
  imageRef: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
});

export type ExpeditionSector = z.infer<typeof sectorSchema>;

// ─── Contenu complet ─────────────────────────────────────────────────────

export const explorationContentSchema = z.object({
  sectors: z.array(sectorSchema).default([]),
  events: z.array(eventSchema).default([]),
  killSwitch: z.boolean().default(false),
});

export type ExplorationContent = z.infer<typeof explorationContentSchema>;

// ─── Default seed (phase 1) ──────────────────────────────────────────────

/**
 * Seed minimal en phase 1 : 3 secteurs (un par tier) et 4 événements
 * basiques pour valider le pipeline de bout en bout. La phase 4 enrichit
 * à 8-12 secteurs et 15-20 événements avec polish narratif.
 */
export const DEFAULT_EXPLORATION_CONTENT: ExplorationContent = {
  killSwitch: false,
  sectors: [
    {
      id: 'theta-7',
      name: 'Secteur Theta-7',
      tier: 'early',
      briefingTemplate: "Un signal répétitif provient d'un système non cartographié. Allez voir ce qui s'y cache.",
      enabled: true,
    },
    {
      id: 'nebuleuse-cygnus',
      name: 'Nébuleuse de Cygnus',
      tier: 'mid',
      briefingTemplate: "Des relevés gravitationnels anormaux suggèrent la présence de vaisseaux abandonnés au cœur de cette nébuleuse dense.",
      enabled: true,
    },
    {
      id: 'faille-halsmar',
      name: 'Faille de Halsmar',
      tier: 'deep',
      briefingTemplate: "Une fracture spatiale aux confins de la galaxie connue. Les rares expéditions revenues parlent de structures impossibles.",
      enabled: true,
    },
  ],
  events: [
    {
      id: 'epave-recyclable',
      tier: 'early',
      title: 'Carcasse à la dérive',
      description: "Vos capteurs détectent une vieille carcasse de cargo, intact mais à l'abandon. Difficile de dire ce qu'elle contient encore.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: 'Recycler la carcasse',
          tone: 'positive',
          hidden: false,
          requirements: [{ kind: 'shipRole', role: 'recycler', minCount: 1 }],
          outcome: {
            minerai: 2500,
            silicium: 1200,
            hydrogene: 0,
            exilium: 0,
            hullDelta: 0,
            bonusBiomeReveal: 0,
            resolutionText: "Vos recycleurs démantèlent la coque proprement. Beau butin de métaux.",
          },
        },
        {
          label: 'Fouiller à la main',
          tone: 'risky',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 800,
            silicium: 400,
            hydrogene: 0,
            exilium: 0,
            hullDelta: 0,
            bonusBiomeReveal: 0,
            resolutionText: "Vos équipes ramènent ce qu'elles peuvent à la main. Mieux que rien.",
          },
        },
        {
          label: 'Laisser la carcasse',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0,
            silicium: 0,
            hydrogene: 0,
            exilium: 0,
            hullDelta: 0,
            bonusBiomeReveal: 0,
            resolutionText: "Vous laissez la carcasse dériver et reprenez la route.",
          },
        },
      ],
    },
    {
      id: 'champ-asteroides-instable',
      tier: 'early',
      title: 'Champ d\'astéroïdes instable',
      description: "Un essaim d'astéroïdes obstrue votre trajectoire. Vous pouvez traverser au prix de quelques impacts, ou contourner en perdant du carburant.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: 'Foncer dans le tas',
          tone: 'risky',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 600,
            silicium: 0,
            hydrogene: 0,
            exilium: 0,
            hullDelta: -0.1,
            bonusBiomeReveal: 0,
            resolutionText: "Quelques impacts, mais vous récoltez des fragments au passage.",
          },
        },
        {
          label: 'Contourner avec précaution',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0,
            silicium: 0,
            hydrogene: -200,
            exilium: 0,
            hullDelta: 0,
            bonusBiomeReveal: 0,
            resolutionText: "Le détour coûte du carburant mais préserve la coque.",
          },
        },
      ],
    },
    {
      id: 'signal-anomalie',
      tier: 'mid',
      title: "Signal d'anomalie gravitationnelle",
      description: "Vos instruments captent la signature d'une anomalie gravitationnelle proche. L'occasion rêvée pour qui aurait l'envie de plonger.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: 'Marquer les coordonnées',
          tone: 'positive',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0,
            silicium: 0,
            hydrogene: 0,
            exilium: 0,
            hullDelta: 0,
            bonusBiomeReveal: 0,
            unlockAnomalyEngagement: { tier: 1 },
            resolutionText: "Vous notez les coordonnées. Un engagement d'anomalie gratuit vous attend au retour.",
          },
        },
        {
          label: 'Ignorer le signal',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0,
            silicium: 0,
            hydrogene: 0,
            exilium: 0,
            hullDelta: 0,
            bonusBiomeReveal: 0,
            resolutionText: "Trop de risques. Vous poursuivez la cartographie.",
          },
        },
      ],
    },
    {
      id: 'station-spectrale',
      tier: 'deep',
      title: 'Station spectrale',
      description: "Une station orbite autour d'une étoile morte. Aucune signe de vie, mais les lumières clignotent encore. Quelque chose vous observe.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: 'Aborder la station',
          tone: 'risky',
          hidden: true,
          requirements: [],
          outcome: {
            minerai: 0,
            silicium: 0,
            hydrogene: 0,
            exilium: 2,
            hullDelta: 0,
            bonusBiomeReveal: 0,
            moduleDrop: { rarity: 'rare', count: 1 },
            resolutionText: "Au cœur de la station, vous trouvez un module ancien d'origine inconnue et un fragment d'Exilium pur.",
          },
        },
        {
          label: "S'éloigner sans faire de bruit",
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0,
            silicium: 0,
            hydrogene: 0,
            exilium: 0,
            hullDelta: 0,
            bonusBiomeReveal: 1,
            resolutionText: "En cartographiant les abords sans intervenir, vous découvrez un biome rare en bordure du système.",
          },
        },
      ],
    },
  ],
};
