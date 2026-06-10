import { Link } from 'react-router';
import { TopBarActions } from './topbar/TopBarActions';

/**
 * Topbar globale desktop du shell « Empire-first » : marque + actions
 * transverses (messages, notifications, rapports, quêtes, profil).
 * Remplace l'ex-bloc planète global (PlanetSubnav) — le contexte planète
 * vit désormais dans le drill-down /planet/:id.
 */
export function GlobalTopbar() {
  return (
    <header className="sticky top-0 z-40 hidden lg:flex items-center justify-between border-b border-border bg-surface px-4 py-1.5 lg:px-6">
      <Link to="/" viewTransition className="text-sm font-semibold text-foreground hover:text-primary transition-colors duration-fast">
        Exilium
      </Link>
      <TopBarActions />
    </header>
  );
}
