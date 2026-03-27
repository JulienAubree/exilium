import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { EditModal } from '@/components/ui/EditModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, Pencil, Trash2, Skull } from 'lucide-react';
import { computeFleetFP, type UnitCombatStats, type FPConfig } from '@ogame-clone/game-engine';

const TIER_COLORS: Record<string, string> = {
  easy: 'text-emerald-400 bg-emerald-900/20',
  medium: 'text-amber-400 bg-amber-900/20',
  hard: 'text-red-400 bg-red-900/20',
};

const FIELDS = [
  { key: 'id', label: 'ID (slug)', type: 'text' as const },
  { key: 'name', label: 'Nom', type: 'text' as const },
  { key: 'tier', label: 'Difficulte', type: 'select' as const, options: [
    { value: 'easy', label: 'Facile' },
    { value: 'medium', label: 'Moyen' },
    { value: 'hard', label: 'Difficile' },
  ]},
  { key: 'ships', label: 'Vaisseaux — ratios (JSON, ex: {"interceptor":3,"frigate":1})', type: 'textarea' as const },
  { key: 'rewardMinerai', label: 'Recompense Minerai (base)', type: 'number' as const },
  { key: 'rewardSilicium', label: 'Recompense Silicium (base)', type: 'number' as const },
  { key: 'rewardHydrogene', label: 'Recompense Hydrogene (base)', type: 'number' as const },
  { key: 'bonusShips', label: 'Bonus Ships (JSON)', type: 'textarea' as const },
];

const EDIT_FIELDS = FIELDS.filter((f) => f.key !== 'id');

function defaultForm(): Record<string, string | number> {
  return {
    id: '',
    name: '',
    tier: 'easy',
    ships: '{}',
    rewardMinerai: 0,
    rewardSilicium: 0,
    rewardHydrogene: 0,
    bonusShips: '[]',
  };
}

function templateToForm(t: any): Record<string, string | number> {
  return {
    name: t.name,
    tier: t.tier,
    ships: JSON.stringify(t.ships, null, 2),
    rewardMinerai: t.rewards?.minerai ?? 0,
    rewardSilicium: t.rewards?.silicium ?? 0,
    rewardHydrogene: t.rewards?.hydrogene ?? 0,
    bonusShips: JSON.stringify(t.rewards?.bonusShips ?? [], null, 2),
  };
}

function formToMutationData(values: Record<string, string | number>) {
  let ships: Record<string, number> = {};
  let bonusShips: { shipId: string; count: number; chance: number }[] = [];
  try { ships = JSON.parse(String(values.ships)); } catch {}
  try { bonusShips = JSON.parse(String(values.bonusShips)); } catch {}

  return {
    name: String(values.name),
    tier: String(values.tier) as 'easy' | 'medium' | 'hard',
    ships,
    rewards: {
      minerai: Number(values.rewardMinerai),
      silicium: Number(values.rewardSilicium),
      hydrogene: Number(values.rewardHydrogene),
      bonusShips,
    },
  };
}

export default function PveMissions() {
  const { data, isLoading, refetch } = useGameConfig();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const createMutation = trpc.gameConfig.admin.createPirateTemplate.useMutation({
    onSuccess: () => { refetch(); setCreating(false); },
  });
  const updateMutation = trpc.gameConfig.admin.updatePirateTemplate.useMutation({
    onSuccess: () => { refetch(); setEditing(null); },
  });
  const deleteMutation = trpc.gameConfig.admin.deletePirateTemplate.useMutation({
    onSuccess: () => { refetch(); setDeleting(null); setDeleteError(null); },
    onError: (err) => { setDeleteError(err.message); },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const templates = [...(data.pirateTemplates ?? [])].sort((a, b) => {
    const tierOrder = { easy: 0, medium: 1, hard: 2 };
    return (tierOrder[a.tier as keyof typeof tierOrder] ?? 0) - (tierOrder[b.tier as keyof typeof tierOrder] ?? 0);
  });

  const shipStats: Record<string, UnitCombatStats> = {};
  if (data) {
    for (const [id, ship] of Object.entries(data.ships)) {
      shipStats[id] = { weapons: ship.weapons, shotCount: ship.shotCount ?? 1, shield: ship.shield, hull: ship.hull };
    }
  }
  const fpConfig: FPConfig = {
    shotcountExponent: Number(data?.universe?.fp_shotcount_exponent ?? 1.5),
    divisor: Number(data?.universe?.fp_divisor ?? 100),
  };

  const editingTemplate = editing ? templates.find((t) => t.id === editing) : null;
  const editValues = editingTemplate ? templateToForm(editingTemplate) : {};

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skull className="w-5 h-5 text-red-400" />
          <h1 className="text-lg font-semibold text-gray-100">Missions PvE — Templates pirates</h1>
        </div>
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
              <th>Difficulte</th>
              <th>Vaisseaux</th>
              <th>FP base</th>
              <th>Recompenses</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const shipSummary = Object.entries(t.ships as Record<string, number>)
                .map(([k, v]) => `${v}x ${k}`)
                .join(', ');
              return (
                <tr key={t.id}>
                  <td className="font-mono text-gray-400 text-xs">{t.id}</td>
                  <td className="font-medium">{t.name}</td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TIER_COLORS[t.tier] ?? ''}`}>
                      {t.tier}
                    </span>
                  </td>
                  <td className="text-xs text-gray-400 max-w-[200px] truncate" title={shipSummary}>
                    {shipSummary}
                  </td>
                  <td className="text-center font-mono text-cyan-400">
                    {computeFleetFP(t.ships as Record<string, number>, shipStats, fpConfig)} FP
                  </td>
                  <td className="text-xs">
                    <span className="text-orange-400">{(t.rewards as any).minerai?.toLocaleString('fr-FR')}</span>
                    {' / '}
                    <span className="text-blue-400">{(t.rewards as any).silicium?.toLocaleString('fr-FR')}</span>
                    {' / '}
                    <span className="text-emerald-400">{(t.rewards as any).hydrogene?.toLocaleString('fr-FR')}</span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(t.id)} className="admin-btn-ghost p-1.5">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setDeleting(t.id); setDeleteError(null); }}
                        className="admin-btn-ghost p-1.5 text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <EditModal
        open={creating}
        title="Nouveau template pirate"
        fields={FIELDS}
        values={defaultForm()}
        saving={createMutation.isPending}
        onClose={() => setCreating(false)}
        onSave={(values) => {
          createMutation.mutate({
            id: String(values.id),
            ...formToMutationData(values),
          });
        }}
      />

      {/* Edit modal */}
      <EditModal
        open={!!editing}
        title={`Modifier ${editingTemplate?.name ?? ''}`}
        fields={EDIT_FIELDS}
        values={editValues}
        saving={updateMutation.isPending}
        onClose={() => setEditing(null)}
        onSave={(values) => {
          if (!editing) return;
          updateMutation.mutate({
            id: editing,
            data: formToMutationData(values),
          });
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        title="Supprimer ce template pirate ?"
        message={deleteError || `Le template "${deleting}" sera supprime. Cette action est irreversible.`}
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
