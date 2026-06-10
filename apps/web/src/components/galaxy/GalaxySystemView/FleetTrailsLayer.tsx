import { useEffect, useState } from 'react';
import { trpc } from '@/trpc';
import {
  STAR_X,
  STAR_Y,
  ORBIT_TOTAL_POSITIONS,
  ORBIT_R_MAX,
  halfCircleOrbitRadius,
  halfCircleSlotAngle,
} from './OrbitalCanvas';

/** Point d'apparition hors champ, dans l'axe radial du slot cible. */
const ENTRY_RADIUS = ORBIT_R_MAX + 70;

/**
 * P5 — la carte vivante : les flottes du joueur visibles en mouvement dans
 * le système affiché. Chaque mouvement voyage le long du rayon de son slot
 * cible (l'aller entre depuis l'extérieur, le retour repart vers lui),
 * position interpolée sur départ→arrivée et rafraîchie chaque seconde.
 */
export function FleetTrailsLayer({ galaxy, system }: { galaxy: number; system: number }) {
  const { data: movements } = trpc.fleet.movements.useQuery(undefined, { refetchInterval: 30_000 });
  const [now, setNow] = useState(() => Date.now());

  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reduced]);

  const visible = (movements ?? []).filter(
    (m) => m.targetGalaxy === galaxy && m.targetSystem === system,
  );
  if (visible.length === 0) return null;

  return (
    <g aria-hidden>
      {visible.map((m) => {
        const departure = new Date(m.departureTime).getTime();
        const arrival = new Date(m.arrivalTime).getTime();
        const span = Math.max(1, arrival - departure);
        const raw = Math.min(1, Math.max(0, (now - departure) / span));
        // L'aller progresse vers le slot ; le retour s'en éloigne.
        const progress = m.phase === 'return' ? 1 - raw : raw;

        const angle = halfCircleSlotAngle(galaxy, system, m.targetPosition);
        const rad = (angle * Math.PI) / 180;
        const slotRadius = halfCircleOrbitRadius(m.targetPosition, ORBIT_TOTAL_POSITIONS);
        const r = ENTRY_RADIUS + (slotRadius - ENTRY_RADIUS) * progress;
        const x = STAR_X + r * Math.cos(rad);
        const y = STAR_Y + r * Math.sin(rad);
        const slotX = STAR_X + slotRadius * Math.cos(rad);
        const slotY = STAR_Y + slotRadius * Math.sin(rad);

        // Orientation du marqueur le long du rayon (vers le slot à l'aller).
        const heading = (angle + (m.phase === 'return' ? 270 : 90)) % 360;

        return (
          <g key={m.id}>
            <line
              x1={x}
              y1={y}
              x2={slotX}
              y2={slotY}
              stroke="hsl(var(--primary))"
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.45}
            />
            <g transform={`translate(${x}, ${y}) rotate(${heading})`}>
              <polygon
                points="0,-6 4.5,5 0,2.5 -4.5,5"
                fill="hsl(var(--primary))"
                opacity={0.95}
              />
            </g>
            <title>
              {m.mission} ({m.phase === 'return' ? 'retour' : 'aller'}) → position {m.targetPosition}
            </title>
          </g>
        );
      })}
    </g>
  );
}
