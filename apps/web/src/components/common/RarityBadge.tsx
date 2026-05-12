import { RARITY_BADGE, RARITY_LABEL, type Rarity } from '@/lib/rarity';
import { cn } from '@/lib/utils';

interface RarityBadgeProps {
  rarity: Rarity;
  /** Affichage compact (pastille + lettre) vs label complet. */
  compact?: boolean;
  /** Override de la quantité affichée (ex: "x3 rare"). */
  count?: number;
  className?: string;
}

/**
 * Badge unifié pour les raretés (commun / rare / épique). Source unique
 * de la palette dans @/lib/rarity. Remplace les 6+ implémentations
 * dispersées (BiomeChips, ExpeditionEventCard, AnomalyEventCard,
 * FlagshipProfile, ModuleDetailModal, etc.).
 */
export function RarityBadge({ rarity, compact = false, count, className }: RarityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border text-[10px] font-semibold uppercase tracking-wider',
        compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
        RARITY_BADGE[rarity],
        className,
      )}
    >
      {count !== undefined && <span className="tabular-nums">×{count}</span>}
      <span>{compact ? RARITY_LABEL[rarity].charAt(0) : RARITY_LABEL[rarity]}</span>
    </span>
  );
}
