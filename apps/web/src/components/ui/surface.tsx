import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** card = surface de contenu ; raised = popover/menu flottant (seule ombre autorisée). */
  variant?: 'card' | 'raised';
  /** Ajoute les états hover/focus pour les surfaces cliquables. */
  interactive?: boolean;
  /** Padding standard (désactivable pour les cartes à image pleine largeur). */
  padded?: boolean;
}

/**
 * LA surface du design system — remplace glass-card, retro-card* et les
 * cartes ad hoc. Un seul matériau : fond plein, bordure 1px, zéro blur,
 * zéro gradient. Réf : docs/reference/design-system.md
 */
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ variant = 'card', interactive = false, padded = true, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border',
        variant === 'card' && 'bg-surface border-border',
        variant === 'raised' && 'bg-surface-raised border-border shadow-raised',
        interactive &&
          'transition-colors duration-fast ease-standard hover:border-border-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer',
        padded && 'p-4',
        className,
      )}
      {...props}
    />
  ),
);
Surface.displayName = 'Surface';
