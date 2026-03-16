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
  { key: 'baseSpeed', label: 'Vitesse', type: 'number' as const },
  { key: 'fuelConsumption', label: 'Carburant', type: 'number' as const },
  { key: 'cargoCapacity', label: 'Cargo', type: 'number' as const },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

export default function Ships() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editing, setEditing] = useState<string | null>(null);

  const updateMutation = trpc.gameConfig.admin.updateShip.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const ships = Object.values(data.ships).sort((a, b) => a.sortOrder - b.sortOrder);
  const editingShip = editing ? data.ships[editing] : null;

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Vaisseaux</h1>

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
              <th>Vitesse</th>
              <th>Cargo</th>
              <th>Moteur</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ships.map((s) => (
              <tr key={s.id}>
                <td className="font-mono text-xs text-gray-500">{s.id}</td>
                <td className="font-medium">{s.name}</td>
                <td className="font-mono text-sm">{s.cost.metal}</td>
                <td className="font-mono text-sm">{s.cost.crystal}</td>
                <td className="font-mono text-sm">{s.cost.deuterium}</td>
                <td className="font-mono text-sm text-red-400">{s.weapons}</td>
                <td className="font-mono text-sm text-blue-400">{s.shield}</td>
                <td className="font-mono text-sm text-yellow-400">{s.armor}</td>
                <td className="font-mono text-sm">{s.baseSpeed}</td>
                <td className="font-mono text-sm">{s.cargoCapacity}</td>
                <td className="text-xs text-gray-500">{s.driveType}</td>
                <td>
                  <button onClick={() => setEditing(s.id)} className="admin-btn-ghost p-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingShip && (
        <EditModal
          open={!!editing}
          title={`Modifier: ${editingShip.name}`}
          fields={FIELDS}
          values={{
            name: editingShip.name,
            description: editingShip.description,
            costMetal: editingShip.cost.metal,
            costCrystal: editingShip.cost.crystal,
            costDeuterium: editingShip.cost.deuterium,
            weapons: editingShip.weapons,
            shield: editingShip.shield,
            armor: editingShip.armor,
            baseSpeed: editingShip.baseSpeed,
            fuelConsumption: editingShip.fuelConsumption,
            cargoCapacity: editingShip.cargoCapacity,
            sortOrder: editingShip.sortOrder,
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
                baseSpeed: values.baseSpeed as number,
                fuelConsumption: values.fuelConsumption as number,
                cargoCapacity: values.cargoCapacity as number,
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
