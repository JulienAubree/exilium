import { memo, useState } from 'react';
import {
  getAssetUrl,
  getEntityVariantProps,
  type AssetCategory,
  type AssetSize,
} from '@/lib/assets';
import { useGameConfig } from '@/hooks/useGameConfig';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

interface GameImageProps {
  category: AssetCategory;
  id: string;
  size?: AssetSize;
  alt: string;
  className?: string;
  /** When provided alongside a buildings/defenses category, the component picks
   *  the biome variant automatically. Mapped to planetType+hasVariant under the
   *  hood so legacy callers still work. */
  planetClassId?: string | null;
  /** Legacy props — explicit override of variant resolution. Take precedence
   *  over planetClassId when set. */
  planetType?: string;
  hasVariant?: boolean;
}

const FALLBACK_COLORS = [
  'bg-primary/20 text-primary',
  'bg-minerai/20 text-minerai',
  'bg-silicium/20 text-silicium',
  'bg-hydrogene/20 text-hydrogene',
  'bg-energy/20 text-energy',
];

function getFallbackColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export const GameImage = memo(function GameImage({
  category,
  id,
  size = 'full',
  alt,
  className,
  planetClassId,
  planetType,
  hasVariant,
}: GameImageProps) {
  const { data: gameConfig } = useGameConfig();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  let resolvedPlanetType = planetType;
  let resolvedHasVariant = hasVariant ?? false;
  if (
    planetType === undefined &&
    hasVariant === undefined &&
    (category === 'buildings' || category === 'defenses')
  ) {
    const props = getEntityVariantProps(gameConfig, category, id, planetClassId);
    resolvedPlanetType = props.planetType;
    resolvedHasVariant = props.hasVariant;
  }

  if (error) {
    const initial = alt.charAt(0).toUpperCase();
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded font-semibold font-mono border border-dashed border-border',
          getFallbackColor(id),
          className,
        )}
      >
        {initial}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {loading && <Skeleton className={cn('absolute inset-0', className)} />}
      <img
        src={getAssetUrl(category, id, size, {
          planetType: resolvedPlanetType,
          hasVariant: resolvedHasVariant,
        })}
        alt={alt}
        className={cn(className, loading && 'opacity-0')}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        onLoad={() => setLoading(false)}
        loading="lazy"
      />
    </div>
  );
});
