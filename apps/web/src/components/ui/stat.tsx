import { cn } from '@/lib/utils';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

export type StatTone = 'default' | 'minerai' | 'silicium' | 'hydrogene' | 'energy' | 'primary' | 'danger';

const TONE_CLASSES: Record<StatTone, string> = {
  default: 'text-foreground',
  minerai: 'text-minerai',
  silicium: 'text-silicium',
  hydrogene: 'text-hydrogene',
  energy: 'text-energy',
  primary: 'text-primary',
  danger: 'text-destructive',
};

export interface StatProps {
  value: number;
  tone?: StatTone;
  icon?: React.ReactNode;
  label?: string;
  /** Suffixe (ex. « /h »). */
  suffix?: string;
  /** Tween de la valeur quand elle change (compteurs de ressources). */
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = { sm: 'text-[13px]', md: 'text-sm', lg: 'text-base' } as const;

/**
 * Affichage canonique d'une valeur numérique de jeu : chiffres tabulaires,
 * couleur sémantique SANS glow, compteur animé optionnel.
 */
export function Stat({ value, tone = 'default', icon, label, suffix, animated = false, size = 'md', className }: StatProps) {
  const animatedValue = useAnimatedNumber(animated ? value : value, animated ? 350 : 0);
  const shown = animated ? animatedValue : value;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {icon}
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className={cn('font-semibold tabular-nums', SIZE_CLASSES[size], TONE_CLASSES[tone])}>
        {Math.round(shown).toLocaleString('fr-FR')}
        {suffix && <span className="font-normal text-muted-foreground">{suffix}</span>}
      </span>
    </span>
  );
}
