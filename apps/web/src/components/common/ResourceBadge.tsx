import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from './ResourceIcons';
import { ExiliumIcon } from './ExiliumIcon';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';

export type Resource = 'minerai' | 'silicium' | 'hydrogene' | 'exilium';

const RESOURCE_TEXT: Record<Resource, string> = {
  minerai: 'text-minerai',
  silicium: 'text-silicium',
  hydrogene: 'text-hydrogene',
  exilium: 'text-purple-300',
};

const RESOURCE_ICON = {
  minerai: MineraiIcon,
  silicium: SiliciumIcon,
  hydrogene: HydrogeneIcon,
  exilium: ExiliumIcon,
} as const;

const RESOURCE_LABEL: Record<Resource, string> = {
  minerai: 'Minerai',
  silicium: 'Silicium',
  hydrogene: 'Hydrogène',
  exilium: 'Exilium',
};

interface ResourceBadgeProps {
  resource: Resource;
  /** Quantité à afficher. Formatée en français complet (`fmt`). */
  amount: number;
  /** Format compact : juste la valeur (sans icône). Par défaut : icône + valeur. */
  variant?: 'default' | 'icon-only' | 'compact';
  /** Force un signe `+` devant les valeurs positives (gains explicites). */
  showSign?: boolean;
  /** Label complet (ex: "Minerai 1 234") au lieu de juste la valeur. */
  withLabel?: boolean;
  className?: string;
}

/**
 * Badge unifié pour afficher une quantité de ressource avec sa couleur
 * et son icône. Source unique de la palette (text-minerai, text-silicium,
 * text-hydrogene, text-purple-300 pour exilium).
 *
 * Remplace les `<span className="text-minerai">M: 1234</span>` éparpillés
 * dans ~50 endroits avec des styles légèrement divergents.
 *
 * Usage :
 *   <ResourceBadge resource="minerai" amount={1234} />
 *   <ResourceBadge resource="exilium" amount={-2} showSign />
 *   <ResourceBadge resource="hydrogene" amount={500} variant="compact" />
 *   <ResourceBadge resource="silicium" amount={300} withLabel />
 */
export function ResourceBadge({
  resource,
  amount,
  variant = 'default',
  showSign = false,
  withLabel = false,
  className,
}: ResourceBadgeProps) {
  const Icon = RESOURCE_ICON[resource];
  const text = RESOURCE_TEXT[resource];
  const sign = showSign && amount > 0 ? '+' : '';
  const label = withLabel ? `${RESOURCE_LABEL[resource]} ` : '';

  if (variant === 'icon-only') {
    return <Icon className={cn(text, className)} />;
  }

  if (variant === 'compact') {
    return (
      <span className={cn('inline-flex items-center gap-0.5 tabular-nums', text, className)}>
        {sign}
        {fmt(amount)}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs tabular-nums', text, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>
        {label}
        {sign}
        {fmt(amount)}
      </span>
    </span>
  );
}
