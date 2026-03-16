import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Save } from 'lucide-react';

export default function RapidFire() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editCell, setEditCell] = useState<{ attacker: string; target: string; value: string } | null>(null);

  const updateMutation = trpc.gameConfig.admin.updateRapidFire.useMutation({
    onSuccess: () => {
      refetch();
      setEditCell(null);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const shipIds = Object.keys(data.ships).sort();
  const defenseIds = Object.keys(data.defenses).sort();
  const allTargets = [...shipIds, ...defenseIds];
  const rf = data.rapidFire;

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Rapid Fire</h1>
      <p className="text-sm text-gray-500 mb-4">
        Cliquez sur une cellule pour editer. Valeur = N signifie (N-1)/N de chance de tirer a nouveau.
      </p>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-panel-light z-10">Attaquant \ Cible</th>
              {allTargets.map((t) => (
                <th key={t} className="text-center whitespace-nowrap px-2">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shipIds.map((attacker) => (
              <tr key={attacker}>
                <td className="font-mono text-gray-400 sticky left-0 bg-panel-light z-10">
                  {attacker}
                </td>
                {allTargets.map((target) => {
                  const value = rf[attacker]?.[target];
                  const isEditing =
                    editCell?.attacker === attacker && editCell?.target === target;

                  return (
                    <td key={target} className="text-center px-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editCell.value}
                            onChange={(e) =>
                              setEditCell({ ...editCell, value: e.target.value })
                            }
                            className="admin-input w-16 text-center py-1 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = parseInt(editCell.value);
                                if (v > 0) {
                                  updateMutation.mutate({
                                    attackerId: attacker,
                                    targetId: target,
                                    value: v,
                                  });
                                }
                              }
                              if (e.key === 'Escape') setEditCell(null);
                            }}
                          />
                          <button
                            onClick={() => {
                              const v = parseInt(editCell.value);
                              if (v > 0) {
                                updateMutation.mutate({
                                  attackerId: attacker,
                                  targetId: target,
                                  value: v,
                                });
                              }
                            }}
                            className="text-hull-400 hover:text-hull-300"
                          >
                            <Save className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setEditCell({
                              attacker,
                              target,
                              value: String(value ?? 0),
                            })
                          }
                          className={`w-full py-1 rounded transition-colors ${
                            value
                              ? 'text-hull-400 font-mono font-medium hover:bg-hull-950/50'
                              : 'text-gray-700 hover:text-gray-500 hover:bg-panel-hover'
                          }`}
                        >
                          {value || '-'}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
