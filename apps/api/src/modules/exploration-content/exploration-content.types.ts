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

// ─── Default seed (phase 4 — contenu enrichi) ────────────────────────────

/**
 * Seed enrichi : 8 secteurs + 17 événements polish narratif.
 *
 * Répartition des événements par palier :
 *   - 6 initiaux (ambiance découverte, choix simples)
 *   - 6 intermédiaires (dilemmes tactiques, gates plus exigeants)
 *   - 5 profonds (narratif épique, récompenses fortes, risques élevés)
 *
 * Outcomes variés : ressources, exilium, modules, coque Δ, biome reveal,
 * crédit anomalie. Un événement "Signal d'anomalie" sert de passerelle
 * vers le mode anomaly.
 */
export const DEFAULT_EXPLORATION_CONTENT: ExplorationContent = {
  killSwitch: false,
  sectors: [
    {
      id: 'theta-7',
      name: 'Secteur Theta-7',
      tier: 'early',
      briefingTemplate: "Un signal répétitif provient d'un système non cartographié aux abords de l'empire. Cartographiez la zone et rapportez ce qui peut l'être.",
      enabled: true,
    },
    {
      id: 'amas-kepler',
      name: 'Amas de Kepler',
      tier: 'early',
      briefingTemplate: "Un amas stellaire dense, riche en astéroïdes et en débris d'anciennes routes commerciales. Une zone calme — en principe.",
      enabled: true,
    },
    {
      id: 'frange-orion',
      name: 'Frange d\'Orion',
      tier: 'early',
      briefingTemplate: "La frontière sud de la galaxie connue. Quelques colonies oubliées y subsistent. Allez voir si elles ont laissé quelque chose derrière elles.",
      enabled: true,
    },
    {
      id: 'nebuleuse-cygnus',
      name: 'Nébuleuse de Cygnus',
      tier: 'mid',
      briefingTemplate: "Des relevés gravitationnels anormaux suggèrent la présence de vaisseaux abandonnés au cœur de cette nébuleuse dense. Naviguez avec prudence.",
      enabled: true,
    },
    {
      id: 'tombeau-vexis',
      name: 'Tombeau de Vexis',
      tier: 'mid',
      briefingTemplate: "Une ancienne bataille spatiale a laissé un cimetière d'épaves dans ce secteur reculé. Les chances de récupération sont élevées, le risque aussi.",
      enabled: true,
    },
    {
      id: 'ceinture-iolanthe',
      name: 'Ceinture d\'Iolanthe',
      tier: 'mid',
      briefingTemplate: "Une ceinture astéroïdale instable où les pirates ont l'habitude de cacher leurs prises. À vos risques.",
      enabled: true,
    },
    {
      id: 'faille-halsmar',
      name: 'Faille de Halsmar',
      tier: 'deep',
      briefingTemplate: "Une fracture spatiale aux confins de la galaxie connue. Les rares expéditions revenues parlent de structures impossibles et de chuchotements gravés dans le métal.",
      enabled: true,
    },
    {
      id: 'noyau-effondre',
      name: 'Noyau effondré',
      tier: 'deep',
      briefingTemplate: "Une étoile à neutrons effondrée au cœur d'un système mort. Sa gravité plie la lumière — et peut-être autre chose.",
      enabled: true,
    },
  ],
  events: [
    // ─── INITIAL (6 événements) ────────────────────────────────────────
    {
      id: 'epave-recyclable',
      tier: 'early',
      title: 'Carcasse à la dérive',
      description: "Vos capteurs détectent une vieille carcasse de cargo, intacte mais à l'abandon. Difficile de dire ce qu'elle contient encore.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: 'Recycler la carcasse',
          tone: 'positive',
          hidden: false,
          requirements: [{ kind: 'shipRole', role: 'recycler', minCount: 1 }],
          outcome: {
            minerai: 2500, silicium: 1200, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vos recycleurs démantèlent la coque proprement. Beau butin de métaux.",
          },
        },
        {
          label: 'Fouiller à la main',
          tone: 'risky',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 800, silicium: 400, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vos équipes ramènent ce qu'elles peuvent à la main. Mieux que rien.",
          },
        },
        {
          label: 'Laisser la carcasse',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vous laissez la carcasse dériver et reprenez la route.",
          },
        },
      ],
    },
    {
      id: 'champ-asteroides-instable',
      tier: 'early',
      title: "Champ d'astéroïdes instable",
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
            minerai: 600, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: -0.1, bonusBiomeReveal: 0,
            resolutionText: "Quelques impacts, mais vous récoltez des fragments au passage.",
          },
        },
        {
          label: 'Contourner avec précaution',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: -200, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Le détour coûte du carburant mais préserve la coque.",
          },
        },
      ],
    },
    {
      id: 'sonde-perdue',
      tier: 'early',
      title: 'Sonde de cartographie perdue',
      description: "Une sonde automatique flotte dans le vide, ses voyants encore actifs. Ses données pourraient révéler des biomes inattendus dans votre propre galaxie.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: 'Extraire les données',
          tone: 'positive',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 200, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 1,
            resolutionText: "Les données chargées dans vos archives révèlent un biome insoupçonné sur l'une de vos positions découvertes.",
          },
        },
        {
          label: 'Démonter pour pièces',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 400, silicium: 800, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Composants récupérés. Les données sont perdues.",
          },
        },
      ],
    },
    {
      id: 'colonie-oubliee',
      tier: 'early',
      title: 'Colonie oubliée',
      description: "Une petite colonie civile à l'arrêt depuis des décennies. Les habitants sont partis, leurs entrepôts ne sont pas tous vides.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: 'Inventorier proprement',
          tone: 'positive',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 1500, silicium: 1500, hydrogene: 800, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vos équipes ramènent un beau lot de ressources civiles.",
          },
        },
        {
          label: 'Honorer les disparus et continuer',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 1,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vous laissez un signal de mémoire. Un fragment d'Exilium étrangement abandonné scintille dans les ruines — on le ramène.",
          },
        },
      ],
    },
    {
      id: 'tempete-radio',
      tier: 'early',
      title: 'Tempête d\'interférences',
      description: "Une perturbation radio massive sature vos systèmes. Vous pouvez la traverser en aveugle ou faire le grand tour.",
      weight: 0.7,
      enabled: true,
      choices: [
        {
          label: 'Traverser au radar passif',
          tone: 'risky',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: -0.05, bonusBiomeReveal: 0,
            resolutionText: "Quelques collisions mineures, mais vous gagnez du temps.",
          },
        },
        {
          label: 'Faire le tour',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: -400, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Détour long mais sûr. Le carburant brûle vite.",
          },
        },
      ],
    },
    {
      id: 'rencontre-marchand',
      tier: 'early',
      title: 'Marchand errant',
      description: "Un petit vaisseau marchand fait signe. Le pilote propose un échange : un peu d'hydrogène contre des minerais bruts.",
      weight: 0.5,
      enabled: true,
      choices: [
        {
          label: 'Échanger',
          tone: 'positive',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: -500, silicium: 0, hydrogene: 600, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Échange honnête. Le marchand vous salue et disparaît dans l'éther.",
          },
        },
        {
          label: 'Décliner poliment',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vous remerciez le pilote et poursuivez votre route.",
          },
        },
      ],
    },

    // ─── INTERMÉDIAIRE (6 événements) ──────────────────────────────────
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
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            unlockAnomalyEngagement: { tier: 1 },
            resolutionText: "Vous notez les coordonnées. Un engagement d'anomalie gratuit vous attend au retour.",
          },
        },
        {
          label: 'Sonder à distance',
          tone: 'neutral',
          hidden: false,
          requirements: [{ kind: 'shipRole', role: 'exploration', minCount: 2 }],
          outcome: {
            minerai: 0, silicium: 800, hydrogene: 0, exilium: 1,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vos sondes ramènent des relevés précieux sans s'approcher du danger.",
          },
        },
        {
          label: 'Ignorer le signal',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Trop de risques. Vous poursuivez la cartographie.",
          },
        },
      ],
    },
    {
      id: 'cimetiere-vaisseaux',
      tier: 'mid',
      title: 'Cimetière de vaisseaux',
      description: "Des dizaines de carcasses dérivent ici, vestiges d'une bataille oubliée. Le butin potentiel est énorme — la dépouille aussi.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: 'Recyclage industriel',
          tone: 'positive',
          hidden: false,
          requirements: [{ kind: 'shipRole', role: 'recycler', minCount: 2 }],
          outcome: {
            minerai: 6000, silicium: 3000, hydrogene: 1000, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vos recycleurs font merveille. Plusieurs jours de récolte intense.",
          },
        },
        {
          label: 'Fouille rapide',
          tone: 'risky',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 2000, silicium: 1000, hydrogene: 0, exilium: 0,
            hullDelta: -0.05, bonusBiomeReveal: 0,
            resolutionText: "Quelques épaves cèdent sous la pression. La coque souffre un peu, le butin est correct.",
          },
        },
        {
          label: 'Cartographier le cimetière',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 200, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 1,
            resolutionText: "Le balayage des épaves révèle des données stellaires. Un biome de votre galaxie en est éclairé.",
          },
        },
      ],
    },
    {
      id: 'patrouille-pirate',
      tier: 'mid',
      title: 'Patrouille pirate',
      description: "Trois corvettes pirates vous prennent en chasse. Combat, négociation, fuite — votre choix.",
      weight: 0.8,
      enabled: true,
      choices: [
        {
          label: 'Engager le combat',
          tone: 'negative',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 1200, silicium: 800, hydrogene: 0, exilium: 0,
            hullDelta: -0.15, bonusBiomeReveal: 0,
            resolutionText: "Combat bref mais brutal. Vos coques sont marquées, mais le butin pirate est saisi.",
          },
        },
        {
          label: 'Négocier un péage',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: -800, silicium: -400, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Le chef pirate accepte un tribut et vous laisse passer.",
          },
        },
        {
          label: 'Tenter de fuir',
          tone: 'risky',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: -800, exilium: 0,
            hullDelta: -0.08, bonusBiomeReveal: 0,
            resolutionText: "Course-poursuite éprouvante. Vous semez les pirates, mais le carburant et la coque y passent.",
          },
        },
      ],
    },
    {
      id: 'station-recherche-abandonnee',
      tier: 'mid',
      title: 'Station de recherche abandonnée',
      description: "Une station de recherche scientifique en orbite autour d'un astéroïde. Les portes sont scellées, les générateurs ronronnent encore.",
      weight: 0.9,
      enabled: true,
      choices: [
        {
          label: 'Forcer les sas',
          tone: 'risky',
          hidden: true,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 1,
            hullDelta: -0.05, bonusBiomeReveal: 0,
            moduleDrop: { rarity: 'common', count: 1 },
            resolutionText: "Quelques pièges désamorcés, un module de protection et de l'Exilium recovered.",
          },
        },
        {
          label: 'Décoder l\'accès',
          tone: 'positive',
          hidden: false,
          requirements: [{ kind: 'research', researchId: 'espionageTech', minLevel: 3 }],
          outcome: {
            minerai: 0, silicium: 2000, hydrogene: 0, exilium: 2,
            hullDelta: 0, bonusBiomeReveal: 0,
            moduleDrop: { rarity: 'rare', count: 1 },
            resolutionText: "Accès propre. Vous repartez avec un module rare et des données précieuses.",
          },
          failureOutcome: {
            minerai: 0, silicium: 200, hydrogene: 0, exilium: 0,
            hullDelta: -0.03, bonusBiomeReveal: 0,
            resolutionText: "Le système refuse votre accès et déclenche une décharge. Maigre récolte.",
          },
        },
        {
          label: 'Laisser tranquille',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vous gardez vos distances. Mieux vaut prévenir.",
          },
        },
      ],
    },
    {
      id: 'derelict-cryogenique',
      tier: 'mid',
      title: 'Vaisseau cryogénique',
      description: "Un vaisseau dormant, en cryogénisation depuis des siècles. Les capsules sont scellées, l'IA de bord encore opérationnelle.",
      weight: 0.7,
      enabled: true,
      choices: [
        {
          label: 'Réveiller l\'équipage',
          tone: 'positive',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 1,
            hullDelta: 0, bonusBiomeReveal: 2,
            resolutionText: "L'équipage réveillé partage la mémoire ancestrale de leurs étoiles. Deux biomes inconnus s'illuminent dans vos archives.",
          },
        },
        {
          label: 'Récupérer la technologie',
          tone: 'neutral',
          hidden: false,
          requirements: [{ kind: 'shipRole', role: 'recycler', minCount: 1 }],
          outcome: {
            minerai: 1000, silicium: 3000, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            moduleDrop: { rarity: 'common', count: 1 },
            resolutionText: "Vous démontez les systèmes. Beau butin technologique. L'équipage ne se réveillera jamais.",
          },
        },
      ],
    },
    {
      id: 'champ-magnetique',
      tier: 'mid',
      title: 'Champ magnétique chaotique',
      description: "Une étoile naine projette un champ magnétique imprévisible. Vos instruments hurlent.",
      weight: 0.5,
      enabled: true,
      choices: [
        {
          label: 'Étudier le phénomène',
          tone: 'risky',
          hidden: false,
          requirements: [{ kind: 'research', researchId: 'planetaryExploration', minLevel: 4 }],
          outcome: {
            minerai: 0, silicium: 1500, hydrogene: 0, exilium: 2,
            hullDelta: 0, bonusBiomeReveal: 1,
            resolutionText: "Vos scientifiques décodent une partie du phénomène. Découverte précieuse.",
          },
          failureOutcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: -0.1, bonusBiomeReveal: 0,
            resolutionText: "Le champ magnétique grille des systèmes. Coque et capteurs endommagés.",
          },
        },
        {
          label: 'Battre en retraite',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: -300, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Retraite prudente. Le carburant y passe.",
          },
        },
      ],
    },

    // ─── PROFOND (5 événements) ─────────────────────────────────────────
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
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 3,
            hullDelta: 0, bonusBiomeReveal: 0,
            moduleDrop: { rarity: 'rare', count: 1 },
            resolutionText: "Au cœur de la station, vous trouvez un module ancien d'origine inconnue et plusieurs fragments d'Exilium pur.",
          },
        },
        {
          label: "S'éloigner sans faire de bruit",
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 2,
            resolutionText: "En cartographiant les abords sans intervenir, vous découvrez deux biomes rares en bordure du système.",
          },
        },
      ],
    },
    {
      id: 'artefact-precurseur',
      tier: 'deep',
      title: 'Artefact précurseur',
      description: "Un monolithe sombre flotte dans le vide. Il n'émet aucun signal détectable, et pourtant il semble vous suivre du regard.",
      weight: 1,
      enabled: true,
      choices: [
        {
          label: "Étudier l'artefact",
          tone: 'positive',
          hidden: false,
          requirements: [{ kind: 'research', researchId: 'planetaryExploration', minLevel: 6 }],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 5,
            hullDelta: 0, bonusBiomeReveal: 0,
            moduleDrop: { rarity: 'epic', count: 1 },
            unlockAnomalyEngagement: { tier: 2 },
            resolutionText: "Vos scientifiques percent un fragment de son secret. Un module épique, de l'Exilium pur, et un crédit d'anomalie palier 2.",
          },
          failureOutcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 1,
            hullDelta: -0.15, bonusBiomeReveal: 0,
            resolutionText: "L'artefact réagit violemment. Vos équipages survivent, mais la coque a souffert.",
          },
        },
        {
          label: "Maintenir la distance",
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vous gardez vos distances. L'artefact n'a pas bougé d'un millimètre quand vous êtes parti.",
          },
        },
      ],
    },
    {
      id: 'flotte-spectrale',
      tier: 'deep',
      title: 'Flotte spectrale',
      description: "Une dizaine de coques massives, alignées en formation parfaite, dérivent dans le vide. Aucune signature thermique. Aucune lumière. Et pourtant, elles se déplacent.",
      weight: 0.8,
      enabled: true,
      choices: [
        {
          label: 'Émettre un signal de paix',
          tone: 'risky',
          hidden: true,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 4,
            hullDelta: 0, bonusBiomeReveal: 3,
            unlockAnomalyEngagement: { tier: 3 },
            resolutionText: "Les coques se mettent à briller doucement. Une voix sans corps vous remercie. Récompenses considérables, et le souvenir de quelque chose d'ancien.",
          },
        },
        {
          label: 'Piller en passant',
          tone: 'negative',
          hidden: false,
          requirements: [{ kind: 'shipRole', role: 'recycler', minCount: 3 }],
          outcome: {
            minerai: 8000, silicium: 8000, hydrogene: 4000, exilium: 0,
            hullDelta: -0.2, bonusBiomeReveal: 0,
            resolutionText: "Vous arrachez des plaques entières aux carcasses. Les coques restent silencieuses. Pour combien de temps ?",
          },
        },
        {
          label: 'Continuer sa route',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vous ne touchez à rien. La flotte continue son ballet silencieux.",
          },
        },
      ],
    },
    {
      id: 'echo-temporel',
      tier: 'deep',
      title: 'Écho temporel',
      description: "Une distorsion locale fait clignoter votre propre vaisseau dans le passé. Vous voyez des versions de votre flotte qui n'ont jamais existé.",
      weight: 0.6,
      enabled: true,
      choices: [
        {
          label: 'Plonger dans la distorsion',
          tone: 'risky',
          hidden: true,
          requirements: [{ kind: 'research', researchId: 'planetaryExploration', minLevel: 5 }],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 3,
            hullDelta: 0.3, bonusBiomeReveal: 2,
            resolutionText: "Vous émergez de l'autre côté avec une coque rajeunie et des souvenirs de mondes que vous n'aviez jamais visités.",
          },
          failureOutcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: -0.3, bonusBiomeReveal: 0,
            resolutionText: "La distorsion vous recrache, vieilli et fatigué. La coque est marquée. Vous ne savez plus combien de temps vous avez passé dedans.",
          },
        },
        {
          label: 'Cartographier le phénomène',
          tone: 'positive',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 1500, hydrogene: 0, exilium: 1,
            hullDelta: 0, bonusBiomeReveal: 1,
            resolutionText: "Vos données vaudront cher dans les archives impériales.",
          },
        },
      ],
    },
    {
      id: 'cathedrale-cosmique',
      tier: 'deep',
      title: 'Cathédrale cosmique',
      description: "Une structure cyclopéenne, taillée dans une lune morte, domine ce système. Des inscriptions dans une langue inconnue couvrent ses parois.",
      weight: 0.5,
      enabled: true,
      choices: [
        {
          label: "Entrer dans la cathédrale",
          tone: 'risky',
          hidden: true,
          requirements: [{ kind: 'shipRole', role: 'exploration', minCount: 3 }],
          outcome: {
            minerai: 0, silicium: 5000, hydrogene: 0, exilium: 7,
            hullDelta: 0, bonusBiomeReveal: 0,
            moduleDrop: { rarity: 'epic', count: 2 },
            unlockAnomalyEngagement: { tier: 3 },
            resolutionText: "Au cœur de la structure, vous trouvez une chambre d'archives. Deux modules épiques, sept fragments d'Exilium, et un crédit pour le palier 3 d'anomalie.",
          },
          failureOutcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: -0.5, bonusBiomeReveal: 0,
            resolutionText: "Sans assez de scouts pour cartographier les couloirs, vous vous perdez. La sortie a coûté cher.",
          },
        },
        {
          label: "Photographier l'extérieur",
          tone: 'positive',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 2000, hydrogene: 0, exilium: 2,
            hullDelta: 0, bonusBiomeReveal: 1,
            resolutionText: "Les images valent leur pesant de silicium. Quelqu'un, dans votre galaxie, reconnaîtra peut-être ces inscriptions.",
          },
        },
        {
          label: 'Ne pas s\'attarder',
          tone: 'neutral',
          hidden: false,
          requirements: [],
          outcome: {
            minerai: 0, silicium: 0, hydrogene: 0, exilium: 0,
            hullDelta: 0, bonusBiomeReveal: 0,
            resolutionText: "Vous partez sans tarder. La cathédrale n'a pas réagi. Bien.",
          },
        },
      ],
    },
  ],
};
