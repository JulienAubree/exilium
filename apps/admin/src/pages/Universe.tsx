import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Save, X, Pencil } from 'lucide-react';

const SECTIONS: { id: string; label: string; keys: string[] }[] = [
  {
    id: 'general',
    label: 'General',
    keys: [
      'name', 'speed', 'galaxies', 'systems', 'positions',
      'maxPlanetsPerPlayer', 'homePlanetDiameter',
      'home_planet_position_min', 'home_planet_position_max',
      'startingMinerai', 'startingSilicium', 'startingHydrogene',
      'cancel_refund_ratio', 'belt_positions',
    ],
  },
  {
    id: 'combat',
    label: 'Combat',
    keys: [
      'debrisRatio', 'lootRatio',
      'combat_max_rounds', 'combat_defense_repair_probability',
      'combat_bounce_threshold', 'combat_rapid_destruction_threshold',
    ],
  },
  {
    id: 'pve',
    label: 'PvE',
    keys: [
      'pve_max_concurrent_missions', 'pve_hydrogene_cap',
      'pve_dismiss_cooldown_hours', 'pve_mission_expiry_days',
      'pve_search_radius', 'pve_tier_medium_unlock', 'pve_tier_hard_unlock',
      'pve_deposit_variance_min', 'pve_deposit_variance_max',
      'pve_discovery_cooldown_base', 'pve_deposit_size_base',
      'slag_rate.pos8', 'slag_rate.pos16',
    ],
  },
  {
    id: 'fp',
    label: 'Facteur de Puissance (FP)',
    keys: [
      'fp_shotcount_exponent', 'fp_divisor',
      'pirate_fp_easy_min', 'pirate_fp_easy_max',
      'pirate_fp_medium_min', 'pirate_fp_medium_max',
      'pirate_fp_hard_min', 'pirate_fp_hard_max',
      'pirate_fp_player_cap_ratio',
    ],
  },
  {
    id: 'fleet',
    label: 'Fleet',
    keys: [
      'fleet_distance_galaxy_factor', 'fleet_distance_system_base',
      'fleet_distance_system_factor', 'fleet_distance_position_base',
      'fleet_distance_position_factor', 'fleet_same_position_distance',
      'fleet_speed_factor',
    ],
  },
  {
    id: 'formulas',
    label: 'Formules',
    keys: [
      'spy_visibility_thresholds', 'ranking_points_divisor',
      'shipyard_time_divisor', 'research_time_divisor',
      'storage_base', 'storage_coeff_a', 'storage_coeff_b', 'storage_coeff_c',
      'satellite_home_planet_energy', 'satellite_base_divisor', 'satellite_base_offset',
      'phase_multiplier',
    ],
  },
];

function getSectionForKey(key: string): string {
  for (const section of SECTIONS) {
    if (section.keys.includes(key)) return section.id;
  }
  return 'other';
}

export default function Universe() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const updateMutation = trpc.gameConfig.admin.updateUniverseConfig.useMutation({
    onSuccess: () => {
      refetch();
      setEditingKey(null);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const entries = Object.entries(data.universe);

  // Group entries by section
  const grouped = new Map<string, [string, unknown][]>();
  for (const entry of entries) {
    const sectionId = getSectionForKey(entry[0]);
    if (!grouped.has(sectionId)) grouped.set(sectionId, []);
    grouped.get(sectionId)!.push(entry);
  }
  for (const arr of grouped.values()) arr.sort(([a], [b]) => a.localeCompare(b));

  const allSections = [
    ...SECTIONS,
    { id: 'other', label: 'Divers', keys: [] as string[] },
  ];

  function handleSave(key: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(editValue);
    } catch {
      parsed = editValue;
    }
    updateMutation.mutate({ key, value: parsed });
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Configuration Univers</h1>

      {allSections.map((section) => {
        const sectionEntries = grouped.get(section.id);
        if (!sectionEntries || sectionEntries.length === 0) return null;
        return (
          <div key={section.id} className="mb-6">
            <h2 className="text-sm font-semibold text-hull-400 uppercase tracking-wider mb-2">
              {section.label}
            </h2>
            <div className="admin-card overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Cle</th>
                    <th>Valeur</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {sectionEntries.map(([key, value]) => {
                    const isEditing = editingKey === key;
                    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

                    return (
                      <tr key={key}>
                        <td className="font-mono text-gray-400 text-sm">{key}</td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="admin-input py-1 text-sm w-full"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave(key);
                                if (e.key === 'Escape') setEditingKey(null);
                              }}
                            />
                          ) : (
                            <span className="font-mono text-sm">{displayValue}</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleSave(key)}
                                disabled={updateMutation.isPending}
                                className="admin-btn-ghost p-1.5 text-hull-400"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingKey(null)} className="admin-btn-ghost p-1.5">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingKey(key);
                                setEditValue(displayValue);
                              }}
                              className="admin-btn-ghost p-1.5"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
