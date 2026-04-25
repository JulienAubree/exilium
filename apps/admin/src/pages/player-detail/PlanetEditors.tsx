import { useState } from 'react';
import { trpc } from '@/trpc';

export function CoordinateEditor({
  planetId,
  galaxy,
  system,
  position,
  onSaved,
}: {
  planetId: string;
  galaxy: number;
  system: number;
  position: number;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ galaxy, system, position });
  const mutation = trpc.playerAdmin.updatePlanetCoordinates.useMutation({ onSuccess: onSaved });

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={form.galaxy}
        onChange={(e) => setForm({ ...form, galaxy: Number(e.target.value) })}
        className="admin-input w-16 py-1 text-xs font-mono"
        title="Galaxie"
        min={1}
      />
      <span className="text-gray-500">:</span>
      <input
        type="number"
        value={form.system}
        onChange={(e) => setForm({ ...form, system: Number(e.target.value) })}
        className="admin-input w-16 py-1 text-xs font-mono"
        title="Systeme"
        min={1}
      />
      <span className="text-gray-500">:</span>
      <input
        type="number"
        value={form.position}
        onChange={(e) => setForm({ ...form, position: Number(e.target.value) })}
        className="admin-input w-16 py-1 text-xs font-mono"
        title="Position"
        min={1}
      />
      <button
        onClick={() => mutation.mutate({ planetId, ...form })}
        disabled={mutation.isPending}
        className="admin-btn-primary py-1 px-3 text-xs"
      >
        {mutation.isPending ? '...' : 'Sauver'}
      </button>
    </div>
  );
}

export function ResourceEditor({
  planetId,
  minerai,
  silicium,
  hydrogene,
  onSaved,
}: {
  planetId: string;
  minerai: string;
  silicium: string;
  hydrogene: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ minerai, silicium, hydrogene });
  const mutation = trpc.playerAdmin.updateResources.useMutation({ onSuccess: onSaved });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={form.minerai}
        onChange={(e) => setForm({ ...form, minerai: e.target.value })}
        className="admin-input w-24 sm:w-28 py-1 text-xs"
        title="Minerai"
      />
      <input
        type="text"
        value={form.silicium}
        onChange={(e) => setForm({ ...form, silicium: e.target.value })}
        className="admin-input w-24 sm:w-28 py-1 text-xs"
        title="Silicium"
      />
      <input
        type="text"
        value={form.hydrogene}
        onChange={(e) => setForm({ ...form, hydrogene: e.target.value })}
        className="admin-input w-24 sm:w-28 py-1 text-xs"
        title="Hydrogène"
      />
      <button
        onClick={() => mutation.mutate({ planetId, ...form })}
        disabled={mutation.isPending}
        className="admin-btn-primary py-1 px-3 text-xs"
      >
        {mutation.isPending ? '...' : 'Sauver'}
      </button>
    </div>
  );
}

export function BuildingEditor({
  planetId,
  buildingLevels,
  buildingDefs,
  onSaved,
}: {
  planetId: string;
  buildingLevels: Record<string, number>;
  buildingDefs: Record<string, { name: string }>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    for (const id of Object.keys(buildingDefs)) s[id] = buildingLevels[id] ?? 0;
    return s;
  });
  const mutation = trpc.playerAdmin.updateBuildingLevel.useMutation({ onSuccess: onSaved });
  const [saving, setSaving] = useState(false);

  const entries = Object.entries(form).sort(([a], [b]) => a.localeCompare(b));

  async function handleSave() {
    setSaving(true);
    const changed = Object.entries(form).filter(([key, val]) => val !== (buildingLevels[key] ?? 0));
    try {
      await Promise.all(changed.map(([buildingId, level]) =>
        mutation.mutateAsync({ planetId, buildingId, level }),
      ));
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (entries.length === 0) return <div className="text-xs text-gray-500 mb-3">Aucun batiment.</div>;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-24 text-right shrink-0 truncate" title={buildingDefs[key]?.name ?? key}>
              {buildingDefs[key]?.name ?? key}
            </label>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
              className="admin-input w-16 py-1 text-xs font-mono"
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="admin-btn-primary py-1 px-3 text-xs"
      >
        {saving ? '...' : 'Sauver batiments'}
      </button>
    </div>
  );
}

const SHIP_FIELDS = [
  { key: 'smallCargo', label: 'Petit cargo' },
  { key: 'largeCargo', label: 'Grand cargo' },
  { key: 'interceptor', label: 'Intercepteur' },
  { key: 'frigate', label: 'Fregate' },
  { key: 'cruiser', label: 'Croiseur' },
  { key: 'battlecruiser', label: 'Croiseur B.' },
  { key: 'espionageProbe', label: 'Sonde espion' },
  { key: 'colonyShip', label: 'Vaiss. colo.' },
  { key: 'recycler', label: 'Recycleur' },
  { key: 'prospector', label: 'Prospecteur' },
  { key: 'recuperateur', label: 'Recuperateur' },
  { key: 'solarSatellite', label: 'Sat. solaire' },
  { key: 'explorer', label: 'Explorateur' },
];

const DEFENSE_FIELDS = [
  { key: 'rocketLauncher', label: 'Lance-roquettes' },
  { key: 'lightLaser', label: 'Laser leger' },
  { key: 'heavyLaser', label: 'Laser lourd' },
  { key: 'electromagneticCannon', label: 'Canon EM' },
  { key: 'plasmaTurret', label: 'Tourelle plasma' },
];

export function ShipEditor({
  planetId,
  ships,
  onSaved,
}: {
  planetId: string;
  ships: Record<string, number> | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    for (const { key } of SHIP_FIELDS) s[key] = ships?.[key] ?? 0;
    return s;
  });
  const mutation = trpc.playerAdmin.updatePlanetShips.useMutation({ onSuccess: onSaved });

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-2">
        {SHIP_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20 text-right shrink-0 truncate" title={label}>{label}</label>
            <input
              type="number"
              min={0}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
              className="admin-input w-16 py-1 text-xs font-mono"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => mutation.mutate({ planetId, ships: form })}
        disabled={mutation.isPending}
        className="admin-btn-primary py-1 px-3 text-xs"
      >
        {mutation.isPending ? '...' : 'Sauver vaisseaux'}
      </button>
    </div>
  );
}

export function DefenseEditor({
  planetId,
  defenses,
  onSaved,
}: {
  planetId: string;
  defenses: Record<string, number> | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    for (const { key } of DEFENSE_FIELDS) s[key] = defenses?.[key] ?? 0;
    return s;
  });
  const mutation = trpc.playerAdmin.updatePlanetDefenses.useMutation({ onSuccess: onSaved });

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-2">
        {DEFENSE_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-24 text-right shrink-0 truncate" title={label}>{label}</label>
            <input
              type="number"
              min={0}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
              className="admin-input w-16 py-1 text-xs font-mono"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => mutation.mutate({ planetId, defenses: form })}
        disabled={mutation.isPending}
        className="admin-btn-primary py-1 px-3 text-xs"
      >
        {mutation.isPending ? '...' : 'Sauver defenses'}
      </button>
    </div>
  );
}
