import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { EditModal } from '@/components/ui/EditModal';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Pencil } from 'lucide-react';

const FIELDS = [
  { key: 'name', label: 'Nom', type: 'text' as const },
  { key: 'description', label: 'Description', type: 'textarea' as const },
  { key: 'costMetal', label: 'Cout Metal', type: 'number' as const },
  { key: 'costCrystal', label: 'Cout Cristal', type: 'number' as const },
  { key: 'costDeuterium', label: 'Cout Deuterium', type: 'number' as const },
  { key: 'weapons', label: 'Armes', type: 'number' as const },
  { key: 'shield', label: 'Bouclier', type: 'number' as const },
  { key: 'armor', label: 'Coque', type: 'number' as const },
  { key: 'maxPerPlanet', label: 'Max par planete (0 = illimite)', type: 'number' as const },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

export default function Defenses() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editing, setEditing] = useState<string | null>(null);

  const updateMutation = trpc.gameConfig.admin.updateDefense.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const defenses = Object.values(data.defenses).sort((a, b) => a.sortOrder - b.sortOrder);
  const editingDef = editing ? data.defenses[editing] : null;

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Defenses</h1>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Metal</th>
              <th>Cristal</th>
              <th>Deut</th>
              <th>Armes</th>
              <th>Bouclier</th>
              <th>Coque</th>
              <th>Max</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {defenses.map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-xs text-gray-500">{d.id}</td>
                <td className="font-medium">{d.name}</td>
                <td className="font-mono text-sm">{d.cost.metal}</td>
                <td className="font-mono text-sm">{d.cost.crystal}</td>
                <td className="font-mono text-sm">{d.cost.deuterium}</td>
                <td className="font-mono text-sm text-red-400">{d.weapons}</td>
                <td className="font-mono text-sm text-blue-400">{d.shield}</td>
                <td className="font-mono text-sm text-yellow-400">{d.armor}</td>
                <td className="font-mono text-sm">{d.maxPerPlanet ?? '-'}</td>
                <td>
                  <button onClick={() => setEditing(d.id)} className="admin-btn-ghost p-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingDef && (
        <EditModal
          open={!!editing}
          title={`Modifier: ${editingDef.name}`}
          fields={FIELDS}
          values={{
            name: editingDef.name,
            description: editingDef.description,
            costMetal: editingDef.cost.metal,
            costCrystal: editingDef.cost.crystal,
            costDeuterium: editingDef.cost.deuterium,
            weapons: editingDef.weapons,
            shield: editingDef.shield,
            armor: editingDef.armor,
            maxPerPlanet: editingDef.maxPerPlanet ?? 0,
            sortOrder: editingDef.sortOrder,
          }}
          onSave={(values) => {
            updateMutation.mutate({
              id: editing!,
              data: {
                name: values.name as string,
                description: values.description as string,
                costMetal: values.costMetal as number,
                costCrystal: values.costCrystal as number,
                costDeuterium: values.costDeuterium as number,
                weapons: values.weapons as number,
                shield: values.shield as number,
                armor: values.armor as number,
                maxPerPlanet: (values.maxPerPlanet as number) || null,
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
