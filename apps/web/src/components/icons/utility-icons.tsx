import type { SVGProps } from 'react';

/**
 * Icônes utilitaires UI fréquemment réutilisées dans le jeu.
 * Centralisées ici pour éviter la duplication de SVG inline dans
 * les composants. Pour les icônes de navigation/jeu, voir `lib/icons.tsx`.
 *
 * Toutes les icônes utilisent `currentColor` et acceptent les props SVG
 * standard (size via width/height, className, onClick, etc.).
 */

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return <svg {...defaults} {...props}>{children}</svg>;
}

/** Horloge — utilisée pour les compteurs de temps, files de construction. */
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icon>
  );
}

/** Croix de fermeture — modals, bannières, tags supprimables. */
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

/** Boîte/cargo — coût unitaire, soute. */
export function CargoBoxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1={3} y1={6} x2={21} y2={6} />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </Icon>
  );
}

/** Éclair — énergie, vitesse, actions instantanées. */
export function LightningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </Icon>
  );
}

/** Chevron droit — pagination, menus déroulants. */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

/** Chevron gauche — navigation arrière. */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

/** Triangle vers le haut — rangs, scores. */
export function TriangleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <polygon points="3,11 22,2 13,21 11,13" />
    </Icon>
  );
}

/** Coche — validations, succès. */
export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

/** Information — tooltips, aide. */
export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  );
}

/** Avertissement — alertes non critiques. */
export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </Icon>
  );
}
