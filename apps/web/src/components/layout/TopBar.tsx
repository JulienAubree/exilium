import { useState } from 'react';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { usePlanetStore } from '@/stores/planet.store';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
}

interface ResourceDisplayProps {
  label: string;
  value: number;
  color: string;
}

function ResourceDisplay({ label, value, color }: ResourceDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {value.toLocaleString('fr-FR')}
      </span>
    </div>
  );
}

export function TopBar({ planetId, planets }: { planetId: string | null; planets: Planet[] }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const clearActivePlanet = usePlanetStore((s) => s.clearActivePlanet);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { data } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId, refetchInterval: 60_000 },
  );

  const resources = useResourceCounter(
    data
      ? {
          metal: data.metal,
          crystal: data.crystal,
          deuterium: data.deuterium,
          resourcesUpdatedAt: data.resourcesUpdatedAt,
          metalPerHour: data.rates.metalPerHour,
          crystalPerHour: data.rates.crystalPerHour,
          deutPerHour: data.rates.deutPerHour,
          storageMetalCapacity: data.rates.storageMetalCapacity,
          storageCrystalCapacity: data.rates.storageCrystalCapacity,
          storageDeutCapacity: data.rates.storageDeutCapacity,
        }
      : undefined,
  );

  const energyBalance = data ? data.rates.energyProduced - data.rates.energyConsumed : 0;
  const activePlanet = planets.find((p) => p.id === planetId);

  const handleSelectPlanet = (id: string) => {
    setActivePlanet(id);
    setDropdownOpen(false);
  };

  const handleLogout = () => {
    clearActivePlanet();
    clearAuth();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-6">
        {/* Planet selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-accent"
          >
            <span className="font-medium">
              {activePlanet ? `${activePlanet.name} [${activePlanet.galaxy}:${activePlanet.system}:${activePlanet.position}]` : 'Planète'}
            </span>
            <span className="text-xs">&#9660;</span>
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-48 rounded-md border border-border bg-card shadow-lg">
              {planets.map((planet) => (
                <button
                  key={planet.id}
                  onClick={() => handleSelectPlanet(planet.id)}
                  className={`flex w-full items-center px-3 py-2 text-sm hover:bg-accent ${
                    planet.id === planetId ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  {planet.name} [{planet.galaxy}:{planet.system}:{planet.position}]
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resources */}
        <ResourceDisplay label="Métal" value={resources.metal} color="text-metal" />
        <ResourceDisplay label="Cristal" value={resources.crystal} color="text-crystal" />
        <ResourceDisplay label="Deutérium" value={resources.deuterium} color="text-deuterium" />
        <ResourceDisplay
          label="Énergie"
          value={energyBalance}
          color={energyBalance >= 0 ? 'text-energy' : 'text-destructive'}
        />
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
