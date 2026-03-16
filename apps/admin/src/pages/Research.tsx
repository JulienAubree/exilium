import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { EditModal } from '@/components/ui/EditModal';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Pencil } from 'lucide-react';

const FIELDS = [
  { key: 'name', label: 'Nom', type: 'text' as const },
  { key: 'description', label: 'Description', type: 'textarea' as const },
  { key: 'baseCostMinerai', label: 'Coût Minerai (base)', type: 'number' as const },
  { key: 'baseCostSilicium', label: 'Coût Silicium (base)', type: 'number' as const },
  { key: 'baseCostHydrogene', label: 'Coût Hydrogène (base)', type: 'number' as const },
  { key: 'costFactor', label: 'Facteur de cout', type: 'number' as const, step: '0.1' },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

export default function Research() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editing, setEditing] = useState<string | null>(null);

  const updateMutation = trpc.gameConfig.admin.updateResearch.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const research = Object.values(data.research).sort((a, b) => a.sortOrder - b.sortOrder);
  const editingResearch = editing ? data.research[editing] : null;

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Recherches</h1>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Minerai</th>
              <th>Silicium</th>
              <th>H₂</th>
              <th>Facteur</th>
              <th>Prerequis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {research.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs text-gray-500">{r.id}</td>
                <td className="font-medium">{r.name}</td>
                <td className="font-mono text-sm">{r.baseCost.minerai}</td>
                <td className="font-mono text-sm">{r.baseCost.silicium}</td>
                <td className="font-mono text-sm">{r.baseCost.hydrogene}</td>
                <td className="font-mono text-sm">{r.costFactor}</td>
                <td className="text-xs text-gray-500">
                  {[
                    ...r.prerequisites.buildings.map((p) => `${p.buildingId} ${p.level}`),
                    ...r.prerequisites.research.map((p) => `${p.researchId} ${p.level}`),
                  ].join(', ') || '-'}
                </td>
                <td>
                  <button
                    onClick={() => setEditing(r.id)}
                    className="admin-btn-ghost p-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingResearch && (
        <EditModal
          open={!!editing}
          title={`Modifier: ${editingResearch.name}`}
          fields={FIELDS}
          values={{
            name: editingResearch.name,
            description: editingResearch.description,
            baseCostMinerai: editingResearch.baseCost.minerai,
            baseCostSilicium: editingResearch.baseCost.silicium,
            baseCostHydrogene: editingResearch.baseCost.hydrogene,
            costFactor: editingResearch.costFactor,
            sortOrder: editingResearch.sortOrder,
          }}
          onSave={(values) => {
            updateMutation.mutate({
              id: editing!,
              data: {
                name: values.name as string,
                description: values.description as string,
                baseCostMinerai: values.baseCostMinerai as number,
                baseCostSilicium: values.baseCostSilicium as number,
                baseCostHydrogene: values.baseCostHydrogene as number,
                costFactor: values.costFactor as number,
                sortOrder: values.sortOrder as number,
              },
            });
          }}
          onClose={() => setEditing(null)}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
