import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { EditModal } from '@/components/ui/EditModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const FIELDS = [
  { key: 'id', label: 'ID (slug)', type: 'text' as const },
  { key: 'name', label: 'Nom', type: 'text' as const },
  { key: 'description', label: 'Description', type: 'textarea' as const },
  { key: 'positions', label: 'Positions (JSON array, ex: [1,2,3])', type: 'text' as const },
  { key: 'mineraiBonus', label: 'Bonus Minerai', type: 'number' as const, step: '0.1' },
  { key: 'siliciumBonus', label: 'Bonus Silicium', type: 'number' as const, step: '0.1' },
  { key: 'hydrogeneBonus', label: 'Bonus Hydrogene', type: 'number' as const, step: '0.1' },
  { key: 'diameterMin', label: 'Diametre Min', type: 'number' as const },
  { key: 'diameterMax', label: 'Diametre Max', type: 'number' as const },
  { key: 'fieldsBonus', label: 'Bonus Cases', type: 'number' as const, step: '0.1' },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

const EDIT_FIELDS = FIELDS.filter((f) => f.key !== 'id');

function defaultForm(): Record<string, string | number> {
  return {
    id: '',
    name: '',
    description: '',
    positions: '[]',
    mineraiBonus: 1.0,
    siliciumBonus: 1.0,
    hydrogeneBonus: 1.0,
    diameterMin: 5000,
    diameterMax: 15000,
    fieldsBonus: 1.0,
    sortOrder: 0,
  };
}

export default function PlanetTypes() {
  const { data, isLoading, refetch } = useGameConfig();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const createMutation = trpc.gameConfig.admin.createPlanetType.useMutation({
    onSuccess: () => { refetch(); setCreating(false); },
  });
  const updateMutation = trpc.gameConfig.admin.updatePlanetType.useMutation({
    onSuccess: () => { refetch(); setEditing(null); },
  });
  const deleteMutation = trpc.gameConfig.admin.deletePlanetType.useMutation({
    onSuccess: () => { refetch(); setDeleting(null); setDeleteError(null); },
    onError: (err) => { setDeleteError(err.message); },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const types = [...(data.planetTypes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  const editingType = editing ? types.find((t) => t.id === editing) : null;
  const editValues: Record<string, string | number> = editingType
    ? {
        name: editingType.name,
        description: editingType.description,
        positions: JSON.stringify(editingType.positions),
        mineraiBonus: editingType.mineraiBonus,
        siliciumBonus: editingType.siliciumBonus,
        hydrogeneBonus: editingType.hydrogeneBonus,
        diameterMin: editingType.diameterMin,
        diameterMax: editingType.diameterMax,
        fieldsBonus: editingType.fieldsBonus,
        sortOrder: editingType.sortOrder,
      }
    : {};

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-100">Types de planetes</h1>
        <button
          onClick={() => setCreating(true)}
          className="admin-btn-primary flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Positions</th>
              <th>Minerai</th>
              <th>Silicium</th>
              <th>H2</th>
              <th>Diam. Min</th>
              <th>Diam. Max</th>
              <th>Cases</th>
              <th>Ordre</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {types.map((pt) => (
              <tr key={pt.id}>
                <td className="font-mono text-gray-400">{pt.id}</td>
                <td>{pt.name}</td>
                <td className="font-mono text-xs">{JSON.stringify(pt.positions)}</td>
                <td className={pt.mineraiBonus !== 1 ? (pt.mineraiBonus > 1 ? 'text-emerald-400' : 'text-red-400') : ''}>
                  x{pt.mineraiBonus}
                </td>
                <td className={pt.siliciumBonus !== 1 ? (pt.siliciumBonus > 1 ? 'text-emerald-400' : 'text-red-400') : ''}>
                  x{pt.siliciumBonus}
                </td>
                <td className={pt.hydrogeneBonus !== 1 ? (pt.hydrogeneBonus > 1 ? 'text-emerald-400' : 'text-red-400') : ''}>
                  x{pt.hydrogeneBonus}
                </td>
                <td>{pt.diameterMin.toLocaleString('fr-FR')}</td>
                <td>{pt.diameterMax.toLocaleString('fr-FR')}</td>
                <td className={pt.fieldsBonus !== 1 ? (pt.fieldsBonus > 1 ? 'text-emerald-400' : 'text-red-400') : ''}>
                  x{pt.fieldsBonus}
                </td>
                <td>{pt.sortOrder}</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(pt.id)}
                      className="admin-btn-ghost p-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setDeleting(pt.id); setDeleteError(null); }}
                      className="admin-btn-ghost p-1.5 text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <EditModal
        open={creating}
        title="Nouveau type de planete"
        fields={FIELDS}
        values={defaultForm()}
        saving={createMutation.isPending}
        onClose={() => setCreating(false)}
        onSave={(values) => {
          let positions: number[];
          try {
            positions = JSON.parse(String(values.positions));
          } catch {
            positions = [];
          }
          createMutation.mutate({
            id: String(values.id),
            name: String(values.name),
            description: String(values.description),
            positions,
            mineraiBonus: Number(values.mineraiBonus),
            siliciumBonus: Number(values.siliciumBonus),
            hydrogeneBonus: Number(values.hydrogeneBonus),
            diameterMin: Number(values.diameterMin),
            diameterMax: Number(values.diameterMax),
            fieldsBonus: Number(values.fieldsBonus),
            sortOrder: Number(values.sortOrder),
          });
        }}
      />

      {/* Edit modal */}
      <EditModal
        open={!!editing}
        title={`Modifier ${editingType?.name ?? ''}`}
        fields={EDIT_FIELDS}
        values={editValues}
        saving={updateMutation.isPending}
        onClose={() => setEditing(null)}
        onSave={(values) => {
          if (!editing) return;
          let positions: number[] | undefined;
          if (values.positions !== undefined) {
            try {
              positions = JSON.parse(String(values.positions));
            } catch {
              positions = undefined;
            }
          }
          updateMutation.mutate({
            id: editing,
            data: {
              name: String(values.name),
              description: String(values.description),
              positions,
              mineraiBonus: Number(values.mineraiBonus),
              siliciumBonus: Number(values.siliciumBonus),
              hydrogeneBonus: Number(values.hydrogeneBonus),
              diameterMin: Number(values.diameterMin),
              diameterMax: Number(values.diameterMax),
              fieldsBonus: Number(values.fieldsBonus),
              sortOrder: Number(values.sortOrder),
            },
          });
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        title="Supprimer ce type de planete ?"
        message={deleteError || `Le type "${deleting}" sera supprime. Cette action est irreversible.`}
        danger
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (deleting) deleteMutation.mutate({ id: deleting });
        }}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
      />
    </div>
  );
}
