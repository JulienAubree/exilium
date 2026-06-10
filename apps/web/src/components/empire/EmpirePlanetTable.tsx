import { useNavigate } from 'react-router';
import { Hammer, FlaskConical, ShieldAlert, ShieldPlus, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlanetStore } from '@/stores/planet.store';
import { ShipyardIcon, FlagshipIcon } from '@/lib/icons';
import { Timer } from '@/components/common/Timer';
import { useGameConfig } from '@/hooks/useGameConfig';
import { getBuildingName, getResearchName, getShipName, getDefenseName } from '@/lib/entity-names';
import { fmtFloor } from '@/lib/format';

interface TablePlanet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  status?: string;
  vocation?: string | null;
  minerai: number;
  silicium: number;
  hydrogene: number;
  hasFlagship: boolean;
  activeBuild: { buildingId: string; level: number; endTime: string } | null;
  activeResearch: { researchId: string; level: number; endTime: string } | null;
  activeShipyard: { shipId: string; quantity: number; endTime: string; facilityId: string | null } | null;
  activeDefense: { defenseId: string; quantity: number; endTime: string } | null;
  inboundAttack: { arrivalTime: string } | null;
}

const VOCATION_LABELS: Record<string, string> = {
  miniere: 'minier',
  industrielle: 'forge',
};

/**
 * Vue table du home Empire — thème « Quart de nuit » S0, commandement n°2
 * (« la table est noble ») : coordonnées mono, file + timer à la seconde,
 * stocks exacts, état en un point. Desktop uniquement (le mobile garde les
 * lignes). Réf : docs/plans/2026-06-10-quart-de-nuit-s0.md
 */
export function EmpirePlanetTable({ planets }: { planets: TablePlanet[] }) {
  const navigate = useNavigate();
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const { data: gameConfig } = useGameConfig();

  const open = (planet: TablePlanet) => {
    setActivePlanet(planet.id);
    navigate(`/planet/${planet.id}`, { viewTransition: true });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-normal">coord.</th>
            <th className="px-3 py-2.5 text-left font-normal">planète</th>
            <th className="px-3 py-2.5 text-left font-normal">vocation</th>
            <th className="px-3 py-2.5 text-left font-normal">file en cours</th>
            <th className="px-3 py-2.5 text-right font-normal">minerai</th>
            <th className="px-3 py-2.5 text-right font-normal">silicium</th>
            <th className="px-3 py-2.5 text-right font-normal">hydrogène</th>
            <th className="px-4 py-2.5 text-right font-normal">état</th>
          </tr>
        </thead>
        <tbody>
          {planets.map((planet) => {
            if (planet.status === 'colonizing') {
              return (
                <tr
                  key={planet.id}
                  onClick={() => open(planet)}
                  className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-accent/30"
                >
                  <td className="px-4 py-2.5 font-mono tabular-nums text-primary">
                    [{planet.galaxy}:{planet.system}:{planet.position}]
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{planet.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">—</td>
                  <td className="px-3 py-2.5" colSpan={4}>
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                      <Rocket className="h-3 w-3" /> Colonisation en cours
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-amber-400">●</td>
                </tr>
              );
            }

            const queue = planet.activeBuild
              ? { icon: Hammer, label: `${getBuildingName(planet.activeBuild.buildingId, gameConfig)} niv. ${planet.activeBuild.level}`, endTime: planet.activeBuild.endTime }
              : planet.activeResearch
                ? { icon: FlaskConical, label: getResearchName(planet.activeResearch.researchId, gameConfig), endTime: planet.activeResearch.endTime }
                : planet.activeShipyard
                  ? { icon: ShipyardIcon, label: `${getShipName(planet.activeShipyard.shipId, gameConfig)} ×${planet.activeShipyard.quantity}`, endTime: planet.activeShipyard.endTime }
                  : planet.activeDefense
                    ? { icon: ShieldPlus, label: `${getDefenseName(planet.activeDefense.defenseId, gameConfig)} ×${planet.activeDefense.quantity}`, endTime: planet.activeDefense.endTime }
                    : null;
            const fileVide = !planet.activeBuild;
            const state = planet.inboundAttack
              ? { className: 'text-destructive', title: 'Attaque entrante' }
              : fileVide
                ? { className: 'text-amber-400', title: 'File de construction vide' }
                : { className: 'text-emerald-400', title: 'Nominal' };

            return (
              <tr
                key={planet.id}
                onClick={() => open(planet)}
                className="cursor-pointer border-b border-border/50 transition-colors last:border-b-0 hover:bg-accent/30"
              >
                <td className="px-4 py-2.5 font-mono tabular-nums text-primary">
                  [{planet.galaxy}:{planet.system}:{planet.position}]
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    {planet.name}
                    {planet.hasFlagship && <FlagshipIcon width={12} height={12} className="shrink-0 text-energy" />}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {planet.vocation ? VOCATION_LABELS[planet.vocation] ?? planet.vocation : '—'}
                </td>
                <td className="px-3 py-2.5">
                  {planet.inboundAttack ? (
                    <span className="inline-flex items-center gap-1.5 text-destructive">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span className="text-xs">Attaque</span>
                      <Timer endTime={new Date(planet.inboundAttack.arrivalTime)} className="inline tabular-nums font-semibold" />
                    </span>
                  ) : queue ? (
                    <span className="inline-flex items-center gap-1.5">
                      <queue.icon className="h-3.5 w-3.5 text-muted-foreground" width={14} height={14} />
                      <span className="truncate text-xs text-foreground">{queue.label}</span>
                      <Timer endTime={new Date(queue.endTime)} className="inline tabular-nums text-live-data" />
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400">file vide</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-minerai">{fmtFloor(planet.minerai)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-silicium">{fmtFloor(planet.silicium)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-hydrogene">{fmtFloor(planet.hydrogene)}</td>
                <td className={cn('px-4 py-2.5 text-right', state.className)} title={state.title}>
                  ●
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
