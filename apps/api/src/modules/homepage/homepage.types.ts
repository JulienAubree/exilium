import { z } from 'zod';
import { safeLinkHref, safeImageSrc } from '@exilium/shared';

/**
 * Zod refinements that delegate URL allowlisting to the shared helpers.
 * Anything that fails (javascript:, data:, malformed) is rejected at the
 * admin-save step, so the public landing never renders a hostile link or
 * image. Allowed: http/https, mailto for links; http/https for images;
 * plus internal `/...` and `#...` paths.
 */
const linkHrefSchema = z.string().min(1).max(500).refine(
  (v) => safeLinkHref(v) !== null,
  { message: 'URL non autorisée (autorisé : http(s), mailto, /chemin, #ancre)' },
);

const optionalLinkHrefSchema = z.string().max(500).refine(
  (v) => v === '' || safeLinkHref(v) !== null,
  { message: 'URL non autorisée (autorisé : http(s), mailto, /chemin, #ancre)' },
).default('');

const imageSrcSchema = z.string().max(500).refine(
  (v) => v === '' || safeImageSrc(v) !== null,
  { message: "Source d'image non autorisée (autorisé : http(s) ou /chemin)" },
);

const requiredImageSrcSchema = z.string().min(1).max(500).refine(
  (v) => safeImageSrc(v) !== null,
  { message: "Source d'image non autorisée (autorisé : http(s) ou /chemin)" },
);

const ctaSchema = z.object({
  label: z.string().min(1).max(80),
  href: linkHrefSchema,
});

const navItemSchema = z.object({
  label: z.string().min(1).max(40),
  href: linkHrefSchema,
});

export const pillarIcons = ['planet', 'building', 'sword', 'shield', 'rocket', 'globe'] as const;
export type PillarIcon = (typeof pillarIcons)[number];

const pillarSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  icon: z.enum(pillarIcons),
  /** Optional custom image. When set and loadable, takes precedence over the icon SVG. */
  image: imageSrcSchema.default(''),
});

const immersiveImageSchema = z.object({
  src: requiredImageSrcSchema,
  alt: z.string().max(200).default(''),
});

const footerLinkSchema = z.object({
  label: z.string().min(1).max(40),
  href: linkHrefSchema,
});

const footerSectionSchema = z.object({
  title: z.string().min(1).max(40),
  links: z.array(footerLinkSchema).max(10),
});

export const socialPlatforms = [
  'discord',
  'twitter',
  'youtube',
  'facebook',
  'instagram',
  'twitch',
  'github',
] as const;
export type SocialPlatform = (typeof socialPlatforms)[number];

const socialSchema = z.object({
  platform: z.enum(socialPlatforms),
  href: linkHrefSchema,
});

export const homepageContentSchema = z.object({
  nav: z.object({
    items: z.array(navItemSchema).max(8),
  }),
  hero: z.object({
    eyebrow: z.string().max(80).default(''),
    title: z.string().min(1).max(60),
    tagline: z.string().max(120).default(''),
    description: z.string().max(500).default(''),
    primaryCta: ctaSchema,
    secondaryCta: ctaSchema.nullable().default(null),
    backgroundImage: imageSrcSchema.default(''),
  }),
  pillars: z.object({
    title: z.string().max(120).default(''),
    items: z.array(pillarSchema).min(0).max(8),
  }),
  immersive: z.object({
    title: z.string().max(120).default(''),
    description: z.string().max(500).default(''),
    ctaLabel: z.string().max(40).default(''),
    ctaHref: optionalLinkHrefSchema,
    images: z.array(immersiveImageSchema).max(6),
  }),
  newsletter: z.object({
    enabled: z.boolean().default(true),
    title: z.string().max(80).default(''),
    description: z.string().max(300).default(''),
    submitLabel: z.string().max(40).default(''),
  }),
  footer: z.object({
    description: z.string().max(300).default(''),
    sections: z.array(footerSectionSchema).max(6),
    socials: z.array(socialSchema).max(8),
    legalNote: z.string().max(200).default(''),
  }),
});

export type HomepageContent = z.infer<typeof homepageContentSchema>;

/**
 * Default content used when the singleton row is missing or its content fails
 * the schema. Acts as the source-of-truth for the initial seed and as a
 * fallback so the public landing never crashes on a malformed admin save.
 */
export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  nav: {
    items: [
      { label: 'Accueil', href: '#accueil' },
      { label: "L'Univers", href: '#univers' },
      { label: 'Gameplay', href: '#gameplay' },
      { label: 'Galerie', href: '#galerie' },
      { label: 'Actualités', href: '/changelog' },
    ],
  },
  hero: {
    eyebrow: '',
    title: 'EXILIUM',
    tagline: 'SURVIVRE. CONSTRUIRE. CONQUÉRIR.',
    description:
      "Exilium est un jeu de stratégie et d'action se déroulant dans un univers lointain, où l'humanité lutte pour sa survie face à des menaces inconnues.",
    primaryCta: { label: 'Inscription bêta', href: '/register' },
    secondaryCta: { label: 'Regarder le trailer', href: '#trailer' },
    backgroundImage: '/assets/landing/hero.webp',
  },
  pillars: {
    title: 'Un univers sans limites',
    items: [
      {
        title: 'Explorer',
        description:
          'Parcourez des planètes inconnues et découvrez des ressources rares.',
        icon: 'planet',
        image: '',
      },
      {
        title: 'Construire',
        description:
          'Développez votre base, recherchez des technologies avancées et renforcez votre empire.',
        icon: 'building',
        image: '',
      },
      {
        title: 'Combattre',
        description:
          'Menez des batailles stratégiques en temps réel et dominez vos ennemis.',
        icon: 'sword',
        image: '',
      },
      {
        title: 'Alliance',
        description:
          "Formez des alliances, participez à des événements mondiaux et écrivez l'histoire d'Exilium.",
        icon: 'shield',
        image: '',
      },
    ],
  },
  immersive: {
    title: 'Univers immersif',
    description:
      'Des environnements spectaculaires, des technologies futuristes et une histoire captivante.',
    ctaLabel: 'Découvrir la galerie',
    ctaHref: '#galerie',
    images: [
      { src: '/assets/landing/immersive-1.webp', alt: 'Paysage glacial' },
      { src: '/assets/landing/immersive-2.webp', alt: 'Cité futuriste' },
      { src: '/assets/landing/immersive-3.webp', alt: 'Tour ardente' },
    ],
  },
  newsletter: {
    enabled: true,
    title: 'Rejoignez la résistance',
    description:
      "Inscrivez-vous dès maintenant pour participer à la bêta et façonner l'avenir d'Exilium.",
    submitLabel: "S'inscrire",
  },
  footer: {
    description:
      "Exilium est un jeu de stratégie et d'action dans un univers de science-fiction riche et immersif.",
    sections: [
      {
        title: 'Jeu',
        links: [
          { label: "L'Univers", href: '#univers' },
          { label: 'Gameplay', href: '#gameplay' },
          { label: 'Factions', href: '#factions' },
          { label: 'Actualités', href: '/changelog' },
        ],
      },
      {
        title: 'Ressources',
        links: [
          { label: 'FAQ', href: '#faq' },
          { label: 'Supports', href: '#supports' },
          { label: 'Presse', href: '#presse' },
          { label: 'Carrières', href: '#carrieres' },
        ],
      },
      {
        title: 'Légal',
        links: [
          { label: 'Mentions légales', href: '/legal' },
          { label: 'Politique de confidentialité', href: '/privacy' },
          { label: "Conditions d'utilisation", href: '/terms' },
        ],
      },
    ],
    socials: [
      { platform: 'discord', href: 'https://discord.gg/exilium' },
      { platform: 'twitter', href: 'https://twitter.com/exilium' },
      { platform: 'youtube', href: 'https://youtube.com/@exilium' },
      { platform: 'facebook', href: 'https://facebook.com/exilium' },
    ],
    legalNote: `© ${new Date().getFullYear()} Exilium. Tous droits réservés.`,
  },
};
