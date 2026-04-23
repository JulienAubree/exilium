import { toKebab, type AssetCategory } from '@exilium/shared';
export type { AssetCategory } from '@exilium/shared';
export type AssetSize = 'full' | 'thumb' | 'icon';

const SUFFIX: Record<AssetSize, string> = {
  full: '',
  thumb: '-thumb',
  icon: '-icon',
};

export interface VariantOptions {
  planetType?: string;
  hasVariant?: boolean;
}

export function getAssetUrl(
  category: AssetCategory,
  id: string,
  size: AssetSize = 'full',
  options?: VariantOptions,
): string {
  const slug = toKebab(id);
  const sfx = SUFFIX[size];
  if (options?.planetType && options.hasVariant && (category === 'buildings' || category === 'defenses')) {
    return `/assets/${category}/${slug}/${options.planetType}${sfx}.webp`;
  }
  return `/assets/${category}/${slug}${sfx}.webp`;
}

export function getPlanetImageUrl(
  planetClassId: string,
  imageIndex: number,
  size: AssetSize = 'full',
): string {
  return `/assets/planets/${planetClassId}/${imageIndex}${SUFFIX[size]}.webp`;
}

export function getFlagshipImageUrl(
  hullId: string,
  imageIndex: number,
  size: AssetSize = 'full',
): string {
  return `/assets/flagships/${hullId}/${imageIndex}${SUFFIX[size]}.webp`;
}
