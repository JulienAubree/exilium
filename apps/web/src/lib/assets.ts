import { toKebab, type AssetCategory } from '@exilium/shared';
export type { AssetCategory } from '@exilium/shared';
export type AssetSize = 'full' | 'thumb' | 'icon';

const SUFFIX: Record<AssetSize, string> = {
  full: '',
  thumb: '-thumb',
  icon: '-icon',
};

export function getAssetUrl(category: AssetCategory, id: string, size: AssetSize = 'full'): string {
  return `/assets/${category}/${toKebab(id)}${SUFFIX[size]}.webp`;
}

export function getPlanetImageUrl(
  planetClassId: string,
  imageIndex: number,
  size: AssetSize = 'full',
): string {
  return `/assets/planets/${planetClassId}/${imageIndex}${SUFFIX[size]}.webp`;
}

export function getFlagshipImageUrl(
  imageIndex: number,
  size: AssetSize = 'full',
): string {
  return `/assets/flagships/${imageIndex}${SUFFIX[size]}.webp`;
}
