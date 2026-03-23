import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { EditModal } from '@/components/ui/EditModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const FIELDS = [
  { key: 'id', label: 'ID', type: 'text' as const },
  { key: 'label', label: 'Label', type: 'text' as const },
  { key: 'hint', label: 'Description', type: 'textarea' as const },
  { key: 'buttonLabel', label: 'Bouton', type: 'text' as const },
  { key: 'color', label: 'Couleur (hex)', type: 'text' as const },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

const EDIT_FIELDS = FIELDS.filter((f) => f.key !== 'id');

function defaultForm() {
  return { id: '', label: '', hint: '', buttonLabel: '', color: '#888888', sortOrder: '0' };
}

export default function Missions() {
  const { data, isLoading, refetch } = useGameConfig();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const createMutation = trpc.gameConfig.admin.createMission.useMutation({
    onSuccess: () => { refetch(); setCreating(false); },
  });
  const updateMutation = trpc.gameConfig.admin.updateMission.useMutation({
    onSuccess: () => { refetch(); setEditing(null); },
  });
  const deleteMutation = trpc.gameConfig.admin.deleteMission.useMutation({
    onSuccess: () => { refetch(); setDeleting(null); setDeleteError(null); },
    onError: (err) => { setDeleteError(err.message); },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const missions = Object.values(data.missions ?? {}).sort((a, b) => a.sortOrder - b.sortOrder);
  const editingMission = editing ? missions.find((m) => m.id === editing) : null;
  const editValues: Record<string, string | number> = {
    label: editingMission?.label ?? '',
    hint: editingMission?.hint ?? '',
    buttonLabel: editingMission?.buttonLabel ?? '',
    color: editingMission?.color ?? '#888888',
    sortOrder: editingMission?.sortOrder ?? 0,
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-100">Missions</h1>
        <button onClick={() => setCreating(true)} className="admin-btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Description</th>
              <th>Bouton</th>
              <th>Couleur</th>
              <th>Ordre</th>
              <th>Danger</th>
              <th>Excl.</th>
              <th>PvE</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {missions.map((m) => (
              <tr key={m.id}>
                <td className="font-mono text-gray-400">{m.id}</td>
                <td>{m.label}</td>
                <td className="max-w-[200px] truncate text-gray-400">{m.hint}</td>
                <td>{m.buttonLabel}</td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: m.color }} />
                    <span className="font-mono text-xs">{m.color}</span>
                  </div>
                </td>
                <td>{m.sortOrder}</td>
                <td>{m.dangerous ? '⚠' : '—'}</td>
                <td>{m.exclusive ? '✓' : '—'}</td>
                <td>{m.requiresPveMission ? '✓' : '—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(m.id)} className="admin-btn-ghost p-1.5">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setDeleting(m.id); setDeleteError(null); }} className="admin-btn-ghost p-1.5 text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditModal
        open={creating}
        title="Nouvelle mission"
        fields={FIELDS}
        values={defaultForm()}
        saving={createMutation.isPending}
        onClose={() => setCreating(false)}
        onSave={(values) => {
          createMutation.mutate({
            id: String(values.id),
            label: String(values.label),
            hint: String(values.hint),
            buttonLabel: String(values.buttonLabel),
            color: String(values.color),
            sortOrder: Number(values.sortOrder),
          });
        }}
      />

      <EditModal
        open={!!editing}
        title={`Modifier ${editingMission?.label ?? ''}`}
        fields={EDIT_FIELDS}
        values={editValues}
        saving={updateMutation.isPending}
        onClose={() => setEditing(null)}
        onSave={(values) => {
          if (!editing) return;
          updateMutation.mutate({
            id: editing,
            data: {
              label: String(values.label),
              hint: String(values.hint),
              buttonLabel: String(values.buttonLabel),
              color: String(values.color),
              sortOrder: Number(values.sortOrder),
            },
          });
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Supprimer cette mission ?"
        message={deleteError || `La mission "${deleting}" sera supprimee. Cette action est irreversible.`}
        danger
        confirmLabel="Supprimer"
        onConfirm={() => { if (deleting) deleteMutation.mutate({ id: deleting }); }}
        onCancel={() => { setDeleting(null); setDeleteError(null); }}
      />
    </div>
  );
}
