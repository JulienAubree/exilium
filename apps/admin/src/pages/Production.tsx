import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Save, X } from 'lucide-react';

interface EditState {
  id: string;
  baseProduction: number;
  exponentBase: number;
  energyConsumption: number | null;
  storageBase: number | null;
}

export default function Production() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editing, setEditing] = useState<EditState | null>(null);

  const updateMutation = trpc.gameConfig.admin.updateProductionConfig.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const entries = Object.values(data.production);

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Configuration Production</h1>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Production base</th>
              <th>Exposant base</th>
              <th>Conso energie</th>
              <th>Stockage base</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((p) => {
              const isEditing = editing?.id === p.id;

              return (
                <tr key={p.id}>
                  <td className="font-mono text-gray-400">{p.id}</td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editing.baseProduction}
                        onChange={(e) => setEditing({ ...editing, baseProduction: Number(e.target.value) })}
                        className="admin-input w-24 py-1 text-sm"
                      />
                    ) : (
                      <span className="font-mono text-sm">{p.baseProduction}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editing.exponentBase}
                        onChange={(e) => setEditing({ ...editing, exponentBase: Number(e.target.value) })}
                        className="admin-input w-24 py-1 text-sm"
                      />
                    ) : (
                      <span className="font-mono text-sm">{p.exponentBase}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editing.energyConsumption ?? ''}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            energyConsumption: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="admin-input w-24 py-1 text-sm"
                        placeholder="null"
                      />
                    ) : (
                      <span className="font-mono text-sm">{p.energyConsumption ?? '-'}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editing.storageBase ?? ''}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            storageBase: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="admin-input w-24 py-1 text-sm"
                        placeholder="null"
                      />
                    ) : (
                      <span className="font-mono text-sm">{p.storageBase ?? '-'}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              id: editing.id,
                              data: {
                                baseProduction: editing.baseProduction,
                                exponentBase: editing.exponentBase,
                                energyConsumption: editing.energyConsumption,
                                storageBase: editing.storageBase,
                              },
                            })
                          }
                          disabled={updateMutation.isPending}
                          className="admin-btn-ghost p-1.5 text-hull-400"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditing(null)} className="admin-btn-ghost p-1.5">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setEditing({
                            id: p.id,
                            baseProduction: p.baseProduction,
                            exponentBase: p.exponentBase,
                            energyConsumption: p.energyConsumption,
                            storageBase: p.storageBase,
                          })
                        }
                        className="admin-btn-ghost p-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
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
}
