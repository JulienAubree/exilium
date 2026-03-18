import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { EditModal } from '@/components/ui/EditModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { PrerequisitesEditor, type MixedPrereq } from '@/components/ui/PrerequisitesEditor';
import { Pencil, Plus, Trash2, Link } from 'lucide-react';

const FIELDS = [
  { key: 'name', label: 'Nom', type: 'text' as const },
  { key: 'description', label: 'Description', type: 'textarea' as const },
  { key: 'baseCostMinerai', label: 'Coût Minerai (base)', type: 'number' as const },
  { key: 'baseCostSilicium', label: 'Coût Silicium (base)', type: 'number' as const },
  { key: 'baseCostHydrogene', label: 'Coût Hydrogène (base)', type: 'number' as const },
  { key: 'costFactor', label: 'Facteur de cout', type: 'number' as const, step: '0.1' },
  { key: 'flavorText', label: "Texte d'ambiance", type: 'textarea' as const },
  { key: 'effectDescription', label: "Description d'effet", type: 'textarea' as const },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

const CREATE_FIELDS = [
  { key: 'id', label: 'ID (identifiant unique)', type: 'text' as const },
  { key: 'levelColumn', label: 'Colonne niveau (DB)', type: 'text' as const },
  ...FIELDS,
];

export default function Research() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingPrereqs, setEditingPrereqs] = useState<string | null>(null);

  const updateMutation = trpc.gameConfig.admin.updateResearch.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
    },
  });

  const createMutation = trpc.gameConfig.admin.createResearch.useMutation({
    onSuccess: () => {
      refetch();
      setCreating(false);
    },
  });

  const prereqsMutation = trpc.gameConfig.admin.updateResearchPrerequisites.useMutation({
    onSuccess: () => {
      refetch();
      setEditingPrereqs(null);
    },
  });

  const deleteMutation = trpc.gameConfig.admin.deleteResearch.useMutation({
    onSuccess: () => {
      refetch();
      setDeleting(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleting(null);
      setDeleteError(err.message);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const research = Object.values(data.research).sort((a, b) => a.sortOrder - b.sortOrder);
  const editingResearch = editing ? data.research[editing] : null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-100">Recherches</h1>
        <button onClick={() => setCreating(true)} className="admin-btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {deleteError && (
        <div className="mb-4 p-3 rounded bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {deleteError}
          <button onClick={() => setDeleteError(null)} className="ml-2 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

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
                  <button
                    onClick={() => setEditingPrereqs(r.id)}
                    className="admin-btn-ghost p-1 inline-flex items-center gap-1 hover:text-hull-400"
                    title="Modifier les prérequis"
                  >
                    <Link className="w-3 h-3" />
                    {[
                      ...r.prerequisites.buildings.map((p) => `${p.buildingId} ${p.level}`),
                      ...r.prerequisites.research.map((p) => `${p.researchId} ${p.level}`),
                    ].join(', ') || '-'}
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditing(r.id)}
                      className="admin-btn-ghost p-1.5"
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleting(r.id)}
                      className="admin-btn-ghost p-1.5 text-red-400 hover:text-red-300"
                      title="Supprimer"
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

      {creating && (
        <EditModal
          open={creating}
          title="Nouvelle recherche"
          fields={CREATE_FIELDS}
          values={{
            id: '',
            levelColumn: '',
            name: '',
            description: '',
            baseCostMinerai: 0,
            baseCostSilicium: 0,
            baseCostHydrogene: 0,
            costFactor: 2,
            sortOrder: 0,
          }}
          onSave={(values) => {
            createMutation.mutate({
              id: values.id as string,
              name: values.name as string,
              description: values.description as string,
              baseCostMinerai: values.baseCostMinerai as number,
              baseCostSilicium: values.baseCostSilicium as number,
              baseCostHydrogene: values.baseCostHydrogene as number,
              costFactor: values.costFactor as number,
              levelColumn: values.levelColumn as string,
              sortOrder: values.sortOrder as number,
            });
          }}
          onClose={() => setCreating(false)}
          saving={createMutation.isPending}
        />
      )}

      {editingPrereqs && data.research[editingPrereqs] && (
        <PrerequisitesEditor
          open={!!editingPrereqs}
          title={`Prérequis: ${data.research[editingPrereqs].name}`}
          mode="mixed"
          mixedPrereqs={[
            ...data.research[editingPrereqs].prerequisites.buildings.map((p) => ({
              requiredBuildingId: p.buildingId,
              requiredLevel: p.level,
            })),
            ...data.research[editingPrereqs].prerequisites.research.map((p) => ({
              requiredResearchId: p.researchId,
              requiredLevel: p.level,
            })),
          ]}
          buildings={Object.values(data.buildings).map((b) => ({ id: b.id, name: b.name }))}
          research={research.map((r) => ({ id: r.id, name: r.name }))}
          onSave={(prereqs) => {
            prereqsMutation.mutate({
              researchId: editingPrereqs,
              prerequisites: (prereqs as MixedPrereq[]).map((p) => ({
                requiredBuildingId: p.requiredBuildingId,
                requiredResearchId: p.requiredResearchId,
                requiredLevel: p.requiredLevel,
              })),
            });
          }}
          onClose={() => setEditingPrereqs(null)}
          saving={prereqsMutation.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Supprimer la recherche"
        message={`Êtes-vous sûr de vouloir supprimer "${deleting ? data.research[deleting]?.name : ''}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        onConfirm={() => {
          if (deleting) deleteMutation.mutate({ id: deleting });
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
