import { Ship, Crown, Shield, Building2 } from 'lucide-react';
import {
  CoordinateEditor,
  ResourceEditor,
  BuildingEditor,
  ShipEditor,
  DefenseEditor,
} from './PlanetEditors';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  planetClassId?: string | null;
  minerai?: string | number | null;
  silicium?: string | number | null;
  hydrogene?: string | number | null;
  buildingLevels?: Record<string, number> | null;
  ships?: Record<string, number> | null;
  defenses?: Record<string, number> | null;
}

export function PlanetCard({
  planet,
  buildingDefs,
  onSetCapital,
  onSaved,
}: {
  planet: Planet;
  buildingDefs: Record<string, { name: string }>;
  onSetCapital: (info: { planetId: string; name: string }) => void;
  onSaved: () => void;
}) {
  return (
    <div className="admin-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-200">{planet.name}</span>
          {planet.planetClassId === 'homeworld' ? (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium text-yellow-400 bg-yellow-900/20">Capitale</span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium text-gray-500 bg-panel">{planet.planetClassId ?? 'colonie'}</span>
          )}
        </div>
        {planet.planetClassId !== 'homeworld' && (
          <button
            onClick={() => onSetCapital({ planetId: planet.id, name: planet.name })}
            className="admin-btn-ghost py-1 px-2 text-xs flex items-center gap-1 text-yellow-400"
          >
            <Crown className="w-3 h-3" /> Definir comme capitale
          </button>
        )}
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">Coordonnees (Galaxie : Systeme : Position)</div>
        <CoordinateEditor
          planetId={planet.id}
          galaxy={planet.galaxy}
          system={planet.system}
          position={planet.position}
          onSaved={onSaved}
        />
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">Ressources (Minerai / Silicium / H₂)</div>
        <ResourceEditor
          planetId={planet.id}
          minerai={String(Math.floor(Number(planet.minerai ?? 0)))}
          silicium={String(Math.floor(Number(planet.silicium ?? 0)))}
          hydrogene={String(Math.floor(Number(planet.hydrogene ?? 0)))}
          onSaved={onSaved}
        />
      </div>

      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
        <Building2 className="w-3 h-3" /> Batiments
      </div>
      <div className="mb-3">
        <BuildingEditor
          planetId={planet.id}
          buildingLevels={planet.buildingLevels ?? {}}
          buildingDefs={buildingDefs}
          onSaved={onSaved}
        />
      </div>

      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
        <Ship className="w-3 h-3" /> Vaisseaux
      </div>
      <div className="mb-3">
        <ShipEditor planetId={planet.id} ships={planet.ships ?? null} onSaved={onSaved} />
      </div>

      <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
        <Shield className="w-3 h-3" /> Defenses
      </div>
      <DefenseEditor planetId={planet.id} defenses={planet.defenses ?? null} onSaved={onSaved} />
    </div>
  );
}
