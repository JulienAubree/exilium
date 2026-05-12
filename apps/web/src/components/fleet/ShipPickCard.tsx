import { memo, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { GameImage } from '@/components/common/GameImage';
import { getFlagshipImageUrl } from '@/lib/assets';
import { QuantityStepper } from '@/components/common/QuantityStepper';
import { cn } from '@/lib/utils';

interface ShipPickCardProps {
  /** Identifiant du vaisseau (game-config key, ex: "interceptor", "explorer"). */
  shipId: string;
  /** Nom affichable (depuis game-config). */
  shipName: string;
  /** Stock disponible sur la planète d'origine. */
  available: number;
  /** Quantité actuellement sélectionnée. */
  value: number;
  /** Mise à jour de la quantité. Bornée à [0, available] par le stepper. */
  onChange: (count: number) => void;
  /** Clic sur la card : sélectionne (value=1) ou désélectionne (value=0). Optionnel. */
  onToggle?: () => void;
  /** Vaisseau non disponible pour le contexte courant (mission incompatible, etc.). */
  disabled?: boolean;
  /** État "incompatible mais sélectionné" — visualisation rouge. */
  conflict?: boolean;
  /** Texte affiché sous le nom en cas de conflict. */
  conflictLabel?: string;
  /** Min de la quantité (0 par défaut). Mis à 1 quand isSelected pour empêcher le retour à 0 sans onToggle. */
  minWhenSelected?: number;
  /** Badge libre (overlay top-left, ex: "Explo" cyan pour les vaisseaux d'exploration). */
  topLeftBadge?: ReactNode;
  /** Quand shipId === 'flagship', résolution de l'image du flagship. */
  flagshipImageIndex?: number;
  hullId?: string;
}

/**
 * Carte de sélection d'un vaisseau — composant unifié partagé entre :
 *  - FleetComposition (page /fleet : envoyer une mission)
 *  - EngageFleetModal (engagement d'expédition deep-space)
 *  - Tout autre contexte de sélection de flotte.
 *
 * Pattern visuel :
 *  - Image hero du vaisseau (GameImage) ou flagship (image utilisateur)
 *  - Badge stock `x{available}` en haut à droite
 *  - Check icon top-left quand sélectionné
 *  - X icon top-left quand conflict
 *  - Badge libre custom en top-left (priorité si fourni et non sélectionné)
 *  - QuantityStepper en pied quand sélectionné
 *  - Label "non disponible" / "incompatible" sinon
 */
export const ShipPickCard = memo(function ShipPickCard({
  shipId,
  shipName,
  available,
  value,
  onChange,
  onToggle,
  disabled = false,
  conflict = false,
  conflictLabel,
  minWhenSelected = 1,
  topLeftBadge,
  flagshipImageIndex,
  hullId,
}: ShipPickCardProps) {
  const isSelected = !disabled && value > 0;
  const isConflict = conflict || (disabled && value > 0);
  const isClickable = !!onToggle && (!disabled || isConflict);

  const isFlagship = shipId === 'flagship';

  return (
    <div
      role={isClickable ? 'button' : undefined}
      onClick={isClickable ? onToggle : undefined}
      className={cn(
        'retro-card overflow-hidden flex flex-col',
        disabled && !isConflict && 'opacity-40',
        isClickable && 'cursor-pointer',
        isSelected && !isConflict && 'border-primary',
        isConflict && 'border-destructive',
      )}
    >
      <div className="relative h-24 overflow-hidden">
        {isFlagship && flagshipImageIndex != null ? (
          <img
            src={getFlagshipImageUrl(hullId ?? 'industrial', flagshipImageIndex, 'full')}
            alt={shipName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <GameImage
            category="ships"
            id={shipId}
            size="full"
            alt={shipName}
            className="w-full h-full object-cover"
          />
        )}

        <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm tabular-nums">
          x{available.toLocaleString('fr-FR')}
        </span>

        {isSelected && !isConflict && (
          <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-md">
            <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
          </div>
        )}
        {isConflict && (
          <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-destructive flex items-center justify-center shadow-md">
            <X className="h-3 w-3 text-destructive-foreground" strokeWidth={3} />
          </div>
        )}
        {!isSelected && !isConflict && topLeftBadge && (
          <div className="absolute top-2 left-2">{topLeftBadge}</div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[13px] font-semibold text-foreground leading-tight line-clamp-2">
          {shipName}
        </span>
        {isConflict ? (
          <span className="text-[10px] text-destructive">
            x{value} — {conflictLabel ?? 'incompatible'}
          </span>
        ) : disabled ? (
          <span className="text-[10px] text-muted-foreground/60">non disponible</span>
        ) : isSelected ? (
          <QuantityStepper
            value={value}
            onChange={onChange}
            min={minWhenSelected}
            max={available}
          />
        ) : null}
      </div>
    </div>
  );
});

/**
 * Grille standard pour afficher plusieurs ShipPickCard dans la même grille
 * responsive (3-4 colonnes selon viewport).
 */
export function ShipPickGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
      {children}
    </div>
  );
}
