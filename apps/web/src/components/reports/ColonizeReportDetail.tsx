import { Link } from 'react-router';
import { trpc } from '@/trpc';
import { ReportHero } from './shared/ReportHero';
import { getShipName } from '@/lib/entity-names';

interface Props {
  result: Record<string, any>;
  fleet: { ships: Record<string, number>; totalCargo: number };
  gameConfig: any;
  coordinates: { galaxy: number; system: number; position: number };
}

function AsteroidIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none" stroke="#94a3b8" strokeWidth="1.5">
      <ellipse cx="22" cy="34" rx="11" ry="8" fill="#334155" />
      <ellipse cx="46" cy="28" rx="8" ry="6" fill="#475569" />
      <ellipse cx="40" cy="48" rx="10" ry="7" fill="#334155" />
      <circle cx="56" cy="44" r="3" fill="#64748b" />
      <circle cx="14" cy="48" r="2" fill="#64748b" />
      <circle cx="58" cy="22" r="1.5" fill="#64748b" />
    </svg>
  );
}

function OccupiedIcon() {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" fill="none">
      <circle cx="36" cy="36" r="24" fill="#78350f" stroke="#fbbf24" strokeWidth="1.5" />
      <circle cx="36" cy="36" r="24" fill="#fbbf24" opacity="0.15" />
      <rect x="29" y="34" width="14" height="11" rx="1.5" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.5" />
      <path d="M32 34 V29 a4 4 0 0 1 8 0 V34" fill="none" stroke="#fbbf24" strokeWidth="1.5" />
    </svg>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#fbbf24' : 'none'} stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 2 L15 9 L22 9 L17 14 L19 22 L12 17 L5 22 L7 14 L2 9 L9 9 Z" />
    </svg>
  );
}

function ShipGrid({ ships, gameConfig }: { ships: Record<string, number>; gameConfig: any }) {
  const entries = Object.entries(ships).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([id, n]) => (
        <span key={id} className="text-sm">
          <span className="text-foreground font-medium">{n}x</span>{' '}
          <span className="text-muted-foreground">{id === 'flagship' ? (gameConfig?.ships?.flagship?.name ?? 'Vaisseau amiral') : getShipName(id, gameConfig)}</span>
        </span>
      ))}
    </div>
  );
}

export function ColonizeReportDetail({ result, fleet, gameConfig, coordinates }: Props) {
  // Success
  if (result.success === true) {
    const planetId = result.planetId as string | undefined;
    const difficulty = Number(result.difficulty ?? 0);
    const { data: planets } = trpc.planet.list.useQuery();
    const newPlanet = planetId ? planets?.find((p: any) => p.id === planetId) : undefined;
    const planetClassId = newPlanet?.planetClassId ?? undefined;

    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates}
          title="Nouvelle colonie"
          statusLabel="Débarquement réussi"
          status="success"
          planetClassId={planetClassId}
          lore="Les premiers modules s'enfoncent dans le régolithe. Le drapeau de votre empire flotte au-dessus d'un monde encore sauvage."
        />

        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Colonie en construction
          </h3>
          <p className="text-sm text-muted-foreground">
            Les opérations de terraformation ont commencé.
          </p>
          {planetId && (
            <Link
              to={`/colonization/${planetId}`}
              className="inline-block mt-3 text-sm text-cyan-400 hover:text-cyan-300 underline"
            >
              Suivre l'avancement →
            </Link>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Difficulté du monde
          </h3>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} filled={i <= difficulty} />)}
            <span className="ml-2 text-sm text-muted-foreground tabular-nums">{difficulty}/5</span>
          </div>
          {difficulty >= 4 && (
            <p className="text-[11px] text-muted-foreground mt-2 italic">
              Colonisation longue, raids plus fréquents.
            </p>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Flotte débarquée
          </h3>
          <ShipGrid ships={fleet.ships} gameConfig={gameConfig} />
        </div>
      </div>
    );
  }

  // Asteroid belt
  if (result.reason === 'asteroid_belt') {
    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates}
          title="Position inhabitable"
          statusLabel="Ceinture d'astéroïdes"
          status="neutral"
          icon={<AsteroidIcon />}
          lore="Le vaisseau colonial n'a trouvé qu'un champ de poussières et de roches."
        />
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raison</h3>
          <p className="text-sm">Ceinture d'astéroïdes. Un recycleur peut exploiter le champ.</p>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte rappelée</h3>
          <ShipGrid ships={fleet.ships} gameConfig={gameConfig} />
        </div>
      </div>
    );
  }

  // Position occupied
  if (result.reason === 'occupied') {
    return (
      <div className="space-y-4">
        <ReportHero
          coords={coordinates}
          title="Position déjà colonisée"
          statusLabel="Arrivée annulée"
          status="warning"
          icon={<OccupiedIcon />}
        />
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raison</h3>
          <p className="text-sm">Une colonie occupe déjà cette position.</p>
        </div>
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Flotte rappelée</h3>
          <ShipGrid ships={fleet.ships} gameConfig={gameConfig} />
        </div>
      </div>
    );
  }

  return null;
}
