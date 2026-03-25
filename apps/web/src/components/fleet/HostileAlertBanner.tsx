import { Link } from 'react-router';
import { Timer } from '@/components/common/Timer';

interface InboundFleet {
  id: string;
  arrivalTime: string; // ISO string — convert to Date for Timer
  targetPlanetName?: string;
  mission: string;
}

interface HostileAlertBannerProps {
  hostileFleets: InboundFleet[];
  /** If true, hides the "Voir details" link (used on the movements page itself) */
  hideLink?: boolean;
}

export function HostileAlertBanner({ hostileFleets, hideLink = false }: HostileAlertBannerProps) {
  if (hostileFleets.length === 0) return null;

  const count = hostileFleets.length;

  return (
    <div
      className="w-full rounded-lg border border-destructive/60 bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/20 px-4 py-3"
      style={{ borderColor: 'hsl(var(--destructive) / 0.6)', background: 'linear-gradient(to right, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.1), hsl(var(--destructive) / 0.2))' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Pulsing red dot */}
          <span className="relative flex h-3 w-3 shrink-0">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: 'hsl(var(--destructive))' }}
            />
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{ backgroundColor: 'hsl(var(--destructive))' }}
            />
          </span>

          {/* Warning triangle icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0"
            style={{ color: 'hsl(var(--destructive))' }}
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>

          <span className="text-sm font-semibold" style={{ color: 'hsl(var(--destructive))' }}>
            {count === 1
              ? '1 flotte hostile en approche'
              : `${count} flottes hostiles en approche`}
          </span>
        </div>

        {!hideLink && (
          <Link
            to="/fleet/movements"
            className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
            style={{ color: 'hsl(var(--destructive))' }}
          >
            Voir details →
          </Link>
        )}
      </div>

      {/* Per-attack details */}
      <ul className="mt-2 space-y-1.5">
        {hostileFleets.map((fleet) => (
          <li key={fleet.id} className="flex items-center gap-2 text-xs" style={{ color: 'hsl(var(--destructive) / 0.85)' }}>
            <span className="shrink-0">▸</span>
            <span className="flex-1 truncate">
              {fleet.targetPlanetName ? (
                <>Attaque sur <span className="font-medium">{fleet.targetPlanetName}</span></>
              ) : (
                'Attaque en approche'
              )}
            </span>
            <Timer
              endTime={new Date(fleet.arrivalTime)}
              className="shrink-0 font-mono"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
