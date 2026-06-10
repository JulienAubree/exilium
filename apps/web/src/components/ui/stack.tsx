import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Échelle d'espacement du design system : 1=4px 2=8px 3=12px 4=16px 5=24px 6=32px. */
export type GapScale = 1 | 2 | 3 | 4 | 5 | 6;

const GAP_CLASSES: Record<GapScale, string> = {
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
  4: 'gap-4',
  5: 'gap-6',
  6: 'gap-8',
};

interface LayoutProps extends HTMLAttributes<HTMLDivElement> {
  gap?: GapScale;
}

/** Empilement vertical à espacement tokenisé. */
export const Stack = forwardRef<HTMLDivElement, LayoutProps>(
  ({ gap = 3, className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col', GAP_CLASSES[gap], className)} {...props} />
  ),
);
Stack.displayName = 'Stack';

interface InlineProps extends LayoutProps {
  /** Alignement vertical des items (center par défaut). */
  align?: 'center' | 'start' | 'baseline';
  wrap?: boolean;
}

/** Rangée horizontale à espacement tokenisé. */
export const Inline = forwardRef<HTMLDivElement, InlineProps>(
  ({ gap = 2, align = 'center', wrap = false, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex',
        align === 'center' && 'items-center',
        align === 'start' && 'items-start',
        align === 'baseline' && 'items-baseline',
        wrap && 'flex-wrap',
        GAP_CLASSES[gap],
        className,
      )}
      {...props}
    />
  ),
);
Inline.displayName = 'Inline';
