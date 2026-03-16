import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { EditModal } from '@/components/ui/EditModal';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Pencil } from 'lucide-react';

const FIELDS = [
  { key: 'name', label: 'Nom', type: 'text' as const },
  { key: 'description', label: 'Description', type: 'textarea' as const },
  { key: 'baseCostMetal', label: 'Cout Metal (base)', type: 'number' as const },
  { key: 'baseCostCrystal', label: 'Cout Cristal (base)', type: 'number' as const },
  { key: 'baseCostDeuterium', label: 'Cout Deuterium (base)', type: 'number' as const },
  { key: 'costFactor', label: 'Facteur de cout', type: 'number' as const, step: '0.1' },
  { key: 'baseTime', label: 'Temps de base (s)', type: 'number' as const },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

export default function Buildings() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editing, setEditing] = useState<string | null>(null);

  const updateMutation = trpc.gameConfig.admin.updateBuilding.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const buildings = Object.values(data.buildings).sort((a, b) => a.sortOrder - b.sortOrder);
  const editingBuilding = editing ? data.buildings[editing] : null;

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Batiments</h1>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Metal</th>
              <th>Cristal</th>
              <th>Deut</th>
              <th>Facteur</th>
              <th>Temps</th>
              <th>Prerequis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((b) => (
              <tr key={b.id}>
                <td className="font-mono text-xs text-gray-500">{b.id}</td>
                <td className="font-medium">{b.name}</td>
                <td className="font-mono text-sm">{b.baseCost.metal}</td>
                <td className="font-mono text-sm">{b.baseCost.crystal}</td>
                <td className="font-mono text-sm">{b.baseCost.deuterium}</td>
                <td className="font-mono text-sm">{b.costFactor}</td>
                <td className="font-mono text-sm">{b.baseTime}s</td>
                <td className="text-xs text-gray-500">
                  {b.prerequisites.length > 0
                    ? b.prerequisites.map((p) => `${p.buildingId} ${p.level}`).join(', ')
                    : '-'}
                </td>
                <td>
                  <button
                    onClick={() => setEditing(b.id)}
                    className="admin-btn-ghost p-1.5"
                    title="Modifier"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingBuilding && (
        <EditModal
          open={!!editing}
          title={`Modifier: ${editingBuilding.name}`}
          fields={FIELDS}
          values={{
            name: editingBuilding.name,
            description: editingBuilding.description,
            baseCostMetal: editingBuilding.baseCost.metal,
            baseCostCrystal: editingBuilding.baseCost.crystal,
            baseCostDeuterium: editingBuilding.baseCost.deuterium,
            costFactor: editingBuilding.costFactor,
            baseTime: editingBuilding.baseTime,
            sortOrder: editingBuilding.sortOrder,
          }}
          onSave={(values) => {
            updateMutation.mutate({
              id: editing!,
              data: {
                name: values.name as string,
                description: values.description as string,
                baseCostMetal: values.baseCostMetal as number,
                baseCostCrystal: values.baseCostCrystal as number,
                baseCostDeuterium: values.baseCostDeuterium as number,
                costFactor: values.costFactor as number,
                baseTime: values.baseTime as number,
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
