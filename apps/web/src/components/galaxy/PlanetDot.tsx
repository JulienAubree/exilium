import { useId } from 'react';
import { TYPE_COLORS, AURA_COLORS, type PlanetAura as SharedPlanetAura } from './planetPalette';

// Re-export for backwards compatibility with any consumer that imported
// `PlanetAura` from this module. The palette type is non-null; PlanetDot
// accepts `null` to mean "no aura".
export type PlanetAura = SharedPlanetAura | null;

export function PlanetDot({
  planetClassId,
  size = 20,
  aura = null,
}: {
  planetClassId: string | null;
  size?: number;
  aura?: PlanetAura;
}) {
  const colors = TYPE_COLORS[planetClassId ?? 'unknown'] ?? TYPE_COLORS.unknown;
  // Stable, unique gradient ids per instance (SSR-safe, survives re-renders).
  const reactId = useId();
  const planetGradId = `planet-${planetClassId ?? 'unknown'}-${reactId}`;
  const auraGradId = `aura-${planetClassId ?? 'unknown'}-${reactId}`;
  const auraColor = aura ? AURA_COLORS[aura] : null;

  // Design choice: keep the viewBox at 20x20 even when an aura is rendered.
  // The halo sits at r=11 (vs. planet r=9) with its radial gradient fading
  // to fully transparent at 100%, so the visible glow stays inside the box.
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="planet-dot">
      <defs>
        <radialGradient id={planetGradId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor={colors.accent} />
          <stop offset="50%" stopColor={colors.from} />
          <stop offset="100%" stopColor={colors.to} />
        </radialGradient>
        {auraColor && (
          <radialGradient id={auraGradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={auraColor} stopOpacity={0.7} />
            <stop offset="100%" stopColor={auraColor} stopOpacity={0} />
          </radialGradient>
        )}
      </defs>
      {auraColor && (
        <circle
          cx="10"
          cy="10"
          r="11"
          fill={`url(#${auraGradId})`}
          className="animate-aura-breathe"
        />
      )}
      <circle cx="10" cy="10" r="9" fill={`url(#${planetGradId})`} />
      <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
    </svg>
  );
}
