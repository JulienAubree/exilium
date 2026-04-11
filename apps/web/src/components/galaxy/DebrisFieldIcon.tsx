/**
 * DebrisFieldIcon — decorative SVG badge for "this slot has a recyclable
 * debris field". Four irregular orange shards that slowly tumble in place.
 *
 * Used by:
 *   - GalaxySystemView/Ribbon.tsx (desktop orbital view, small badge)
 *   - pages/Galaxy.tsx legacy mobile list (same visual language)
 *   - any future detail-panel header that wants a quick inline marker
 *
 * The shards use `transform-box: fill-box` + `transform-origin: center` via
 * the `.debris-shard` class so they rotate around their own centroid. Each
 * shard has a slightly different delay/duration (`.debris-shard-{1..4}`)
 * so the animation never looks locked in sync. Respects
 * `prefers-reduced-motion`.
 */

import type { ReactElement } from 'react';
import { BELT_DEBRIS_COLOR } from './planetPalette';

export interface DebrisFieldIconProps {
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}

export function DebrisFieldIcon({
  size = 20,
  color = BELT_DEBRIS_COLOR,
  className,
  title,
}: DebrisFieldIconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}

      {/* Top-left shard — pentagonal chunk */}
      <polygon
        className="debris-shard debris-shard-1"
        points="4,3 8,2 9,6 6,7 3,6"
        fill={color}
      />

      {/* Top-right shard — angular shard */}
      <polygon
        className="debris-shard debris-shard-2"
        points="13,4 17,5 16,9 13,8"
        fill={color}
        fillOpacity={0.9}
      />

      {/* Bottom-left shard — small fragment */}
      <polygon
        className="debris-shard debris-shard-3"
        points="3,13 6,12 7,15 4,16"
        fill={color}
        fillOpacity={0.85}
      />

      {/* Bottom-right shard — largest chunk with a notch */}
      <polygon
        className="debris-shard debris-shard-4"
        points="11,11 15,10 17,13 15,16 12,16 10,14"
        fill={color}
      />
    </svg>
  );
}
