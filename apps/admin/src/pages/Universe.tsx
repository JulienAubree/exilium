import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Save, X } from 'lucide-react';

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

  const entries = Object.entries(data.universe).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Configuration Univers</h1>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cle</th>
              <th>Valeur</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([key, value]) => {
              const isEditing = editingKey === key;
              const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

              return (
                <tr key={key}>
                  <td className="font-mono text-gray-400">{key}</td>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="admin-input py-1 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            let parsed: unknown;
                            try {
                              parsed = JSON.parse(editValue);
                            } catch {
                              parsed = editValue;
                            }
                            updateMutation.mutate({ key, value: parsed });
                          }
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
                          onClick={() => {
                            let parsed: unknown;
                            try {
                              parsed = JSON.parse(editValue);
                            } catch {
                              parsed = editValue;
                            }
                            updateMutation.mutate({ key, value: parsed });
                          }}
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
