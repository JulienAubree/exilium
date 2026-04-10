/**
 * SlotMarker — renders ONE slot on the orbital canvas as an SVG `<g>`.
 *
 * Returns a `<g>` (not a full `<svg>`) so it composes inside a parent SVG
 * that owns the viewBox / transform stack. Do NOT swap for `<PlanetDot>` here:
 * that component returns its own `<svg>` and is meant for the ribbon / detail
 * panel, not for use inside another SVG.
 *
 * Belts return `null` — the parent (OrbitalCanvas) renders one
 * `<OrbitalDebrisRing>` per belt position, sized to the orbit, not to the slot.
 */

import { useId, type KeyboardEvent, type ReactElement } from 'react';
import type { SlotView } from './slotView';

const TYPE_COLORS: Record<string, { from: string; to: string; accent: string }> = {
  volcanic:  { from: '#ef4444', to: '#f97316', accent: '#fbbf24' },
  arid:      { from: '#d97706', to: '#92400e', accent: '#fbbf24' },
  temperate: { from: '#22c55e', to: '#3b82f6', accent: '#86efac' },
  glacial:   { from: '#93c5fd', to: '#e0f2fe', accent: '#ffffff' },
  gaseous:   { from: '#a855f7', to: '#ec4899', accent: '#e879f9' },
  homeworld: { from: '#22d3ee', to: '#10b981', accent: '#a7f3d0' },
  unknown:   { from: '#52525b', to: '#27272a', accent: '#a1a1aa' },
};

const AURA_COLORS: Record<'mine' | 'ally' | 'enemy', string> = {
  mine:  '#67e8f9',
  ally:  '#60a5fa',
  enemy: '#f87171',
};

export interface SlotMarkerProps {
  view: SlotView;
  cx: number;
  cy: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (position: number) => void;
  onHoverChange: (position: number | null) => void;
}

function ariaLabelFor(view: SlotView): string {
  switch (view.kind) {
    case 'planet': {
      const rel =
        view.relation === 'mine'
          ? 'votre planète'
          : view.relation === 'ally'
            ? 'planète alliée'
            : 'planète hostile';
      return `Position ${view.position}, ${view.planetName}, ${rel}`;
    }
    case 'empty-discovered':
      return `Position ${view.position}, libre, type ${view.planetClassId}`;
    case 'undiscovered':
      return `Position ${view.position}, inconnu`;
    case 'belt':
      return `Position ${view.position}, ceinture d'astéroïdes`;
  }
}

export function SlotMarker({
  view,
  cx,
  cy,
  isSelected,
  isHovered,
  onClick,
  onHoverChange,
}: SlotMarkerProps) {
  // Hooks must be called unconditionally — do the early return AFTER.
  const rawId = useId();

  // Belts are rendered by the parent as orbit-scaled debris rings.
  if (view.kind === 'belt') return null;

  const haloGradId = `slot-${rawId}-halo`;
  const planetGradId = `slot-${rawId}-planet`;
  const undiscoveredGradId = `slot-${rawId}-unknown`;

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      onClick(view.position);
    }
  };

  const haloRadius = isHovered ? 15.4 : 14;

  let body: ReactElement | null = null;
  let defs: ReactElement | null = null;

  if (view.kind === 'planet') {
    const colors = TYPE_COLORS[view.planetClassId ?? 'unknown'] ?? TYPE_COLORS.unknown;
    const auraColor = AURA_COLORS[view.relation];

    defs = (
      <defs>
        <radialGradient id={haloGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={auraColor} stopOpacity={0.7} />
          <stop offset="100%" stopColor={auraColor} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={planetGradId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={colors.accent} />
          <stop offset="50%" stopColor={colors.from} />
          <stop offset="100%" stopColor={colors.to} />
        </radialGradient>
      </defs>
    );

    body = (
      <>
        <circle
          cx={cx}
          cy={cy}
          r={haloRadius}
          fill={`url(#${haloGradId})`}
          className="animate-aura-breathe"
        />
        <circle cx={cx} cy={cy} r={4.5} fill={`url(#${planetGradId})`} />
        <circle
          cx={cx}
          cy={cy}
          r={4.5}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={0.4}
        />
      </>
    );
  } else if (view.kind === 'empty-discovered') {
    const typeColor =
      (TYPE_COLORS[view.planetClassId] ?? TYPE_COLORS.unknown).from;
    body = (
      <circle
        cx={cx}
        cy={cy}
        r={isHovered ? 5.5 : 5}
        fill="none"
        stroke={typeColor}
        strokeWidth={0.8}
        strokeDasharray="1.5 1.5"
      />
    );
  } else {
    // undiscovered
    defs = (
      <defs>
        <radialGradient id={undiscoveredGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
      </defs>
    );
    body = (
      <circle
        cx={cx}
        cy={cy}
        r={isHovered ? 4.4 : 4}
        fill={`url(#${undiscoveredGradId})`}
        opacity={0.55}
      />
    );
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={ariaLabelFor(view)}
      aria-pressed={isSelected}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(view.position)}
      onMouseEnter={() => onHoverChange(view.position)}
      onMouseLeave={() => onHoverChange(null)}
      onKeyDown={handleKeyDown}
    >
      {defs}
      {body}
      {isSelected && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={14}
            fill="none"
            stroke="#fffbe8"
            strokeWidth={0.8}
            strokeDasharray="4 4"
            className="animate-selection-rotate"
          />
          <line x1={cx} y1={cy - 17} x2={cx} y2={cy - 11} stroke="#fffbe8" strokeWidth={0.8} />
          <line x1={cx} y1={cy + 11} x2={cx} y2={cy + 17} stroke="#fffbe8" strokeWidth={0.8} />
          <line x1={cx - 17} y1={cy} x2={cx - 11} y2={cy} stroke="#fffbe8" strokeWidth={0.8} />
          <line x1={cx + 11} y1={cy} x2={cx + 17} y2={cy} stroke="#fffbe8" strokeWidth={0.8} />
        </>
      )}
    </g>
  );
}
