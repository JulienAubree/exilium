import { cn } from '@/lib/utils';

export interface ProgressProps {
  /** Progression 0..1. */
  value: number;
  tone?: 'primary' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

const TONE_CLASSES = {
  primary: 'bg-primary',
  warning: 'bg-amber-400',
  danger: 'bg-destructive',
} as const;

/**
 * Barre de progression du design system : fond neutre, remplissage plein
 * (pas de gradient), transition douce sur la largeur.
 */
export function Progress({ value, tone = 'primary', size = 'md', className, ...aria }: ProgressProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={aria['aria-label']}
      className={cn(
        'w-full overflow-hidden rounded-full bg-secondary',
        size === 'sm' ? 'h-1' : 'h-1.5',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-base ease-standard', TONE_CLASSES[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
