/**
 * PlanetVisual — displays the real planet image when available,
 * with a graceful fallback to the procedural SVG <PlanetDot>.
 *
 * Use this in any UI surface that wants the canonical "this is what
 * the planet looks like" visual: ribbon mini, hover tooltip, detail
 * panel header, etc. Never use it inside another <svg> (like
 * OrbitalCanvas's main map) — for that, render planet primitives
 * directly so they compose into the parent SVG.
 */

import { useState, type ReactElement } from 'react';
import { getPlanetImageUrl, type AssetSize } from '@/lib/assets';
import { PlanetDot, type PlanetAura } from './PlanetDot';
import { AURA_COLORS } from './planetPalette';

export interface PlanetVisualProps {
  planetClassId: string | null;
  planetImageIndex: number | null;
  size: number;
  aura?: PlanetAura;
  variant?: AssetSize;       // default 'icon' for ribbon/tooltip, 'thumb' for detail panel
  glow?: boolean;            // adds a soft box-shadow halo when an aura is set (default false)
}

export function PlanetVisual({
  planetClassId,
  planetImageIndex,
  size,
  aura = null,
  variant = 'icon',
  glow = false,
}: PlanetVisualProps): ReactElement {
  const [errored, setErrored] = useState(false);

  const useImage =
    !!planetClassId && planetImageIndex != null && !errored;

  if (!useImage) {
    return (
      <PlanetDot
        planetClassId={planetClassId}
        size={size}
        aura={aura}
      />
    );
  }

  // Faction border ring + optional glow.
  const borderColor = aura ? AURA_COLORS[aura] : 'rgba(255,255,255,0.15)';
  const borderWidth = aura ? 2 : 1;
  const boxShadow =
    glow && aura ? `0 0 ${size * 0.25}px ${AURA_COLORS[aura]}` : undefined;

  return (
    <img
      src={getPlanetImageUrl(planetClassId!, planetImageIndex!, variant)}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover block"
      style={{
        width: size,
        height: size,
        border: `${borderWidth}px solid ${borderColor}`,
        boxShadow,
      }}
      onError={() => setErrored(true)}
      draggable={false}
    />
  );
}
