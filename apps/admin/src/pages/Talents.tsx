import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { EditModal } from '@/components/ui/EditModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, Sparkles } from 'lucide-react';
import { BRANCH_FIELDS, BRANCH_EDIT_FIELDS } from './talents/constants';
import {
  defaultBranchForm,
  branchToForm,
  talentFields,
  defaultTalentForm,
  talentToForm,
  formToTalentData,
} from './talents/helpers';
import { FlagshipImagePool } from './talents/FlagshipImagePool';
import { HullConfigSection } from './talents/HullConfigSection';
import { BranchCard } from './talents/BranchCard';

export default function Talents() {
  const { data, isLoading, refetch } = useGameConfig();

  // Branch state
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);

  // Talent state
  const [creatingTalent, setCreatingTalent] = useState<string | null>(null); // branchId
  const [editingTalent, setEditingTalent] = useState<string | null>(null);
  const [deletingTalent, setDeletingTalent] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Collapsed branches
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Branch mutations
  const createBranchMut = trpc.gameConfig.admin.createTalentBranch.useMutation({
    onSuccess: () => { refetch(); setCreatingBranch(false); },
  });
  const updateBranchMut = trpc.gameConfig.admin.updateTalentBranch.useMutation({
    onSuccess: () => { refetch(); setEditingBranch(null); },
  });
  const deleteBranchMut = trpc.gameConfig.admin.deleteTalentBranch.useMutation({
    onSuccess: () => { refetch(); setDeletingBranch(null); setDeleteError(null); },
    onError: (err) => setDeleteError(err.message),
  });

  // Talent mutations
  const createTalentMut = trpc.gameConfig.admin.createTalent.useMutation({
    onSuccess: () => { refetch(); setCreatingTalent(null); },
  });
  const updateTalentMut = trpc.gameConfig.admin.updateTalent.useMutation({
    onSuccess: () => { refetch(); setEditingTalent(null); },
  });
  const deleteTalentMut = trpc.gameConfig.admin.deleteTalent.useMutation({
    onSuccess: () => { refetch(); setDeletingTalent(null); setDeleteError(null); },
    onError: (err) => setDeleteError(err.message),
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const branches = [...(data.talentBranches ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const allTalents = Object.values(data.talents ?? {});
  const talentsByBranch = (branchId: string) =>
    allTalents
      .filter((t) => t.branchId === branchId)
      .sort((a, b) => a.tier - b.tier || a.sortOrder - b.sortOrder);

  const branchOptions = branches.map((b) => ({ id: b.id, name: b.name }));
  const talentOptions = allTalents.map((t) => ({ id: t.id, name: t.name }));

  const editingBranchData = editingBranch ? branches.find((b) => b.id === editingBranch) : null;
  const editingTalentData = editingTalent ? allTalents.find((t) => t.id === editingTalent) : null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h1 className="text-lg font-semibold text-gray-100">Talents du Flagship</h1>
        </div>
        <button onClick={() => setCreatingBranch(true)} className="admin-btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Nouvelle branche
        </button>
      </div>

      <FlagshipImagePool />
      <HullConfigSection hulls={data?.hulls ?? {}} onUpdated={refetch} />

      {branches.length === 0 && (
        <div className="admin-card p-8 text-center text-gray-500">Aucune branche de talent configuree.</div>
      )}

      {branches.map((branch) => (
        <BranchCard
          key={branch.id}
          branch={branch}
          talents={talentsByBranch(branch.id)}
          isCollapsed={collapsed.has(branch.id)}
          onToggleCollapse={() => toggleCollapse(branch.id)}
          onCreateTalent={() => setCreatingTalent(branch.id)}
          onEditBranch={() => setEditingBranch(branch.id)}
          onDeleteBranch={() => { setDeletingBranch(branch.id); setDeleteError(null); }}
          onEditTalent={(id) => setEditingTalent(id)}
          onDeleteTalent={(id) => { setDeletingTalent(id); setDeleteError(null); }}
        />
      ))}

      {/* ── Branch modals ── */}
      <EditModal
        open={creatingBranch}
        title="Nouvelle branche de talent"
        fields={BRANCH_FIELDS}
        values={defaultBranchForm()}
        saving={createBranchMut.isPending}
        onClose={() => setCreatingBranch(false)}
        onSave={(values) => {
          createBranchMut.mutate({
            id: String(values.id),
            name: String(values.name),
            description: String(values.description),
            color: String(values.color),
            sortOrder: Number(values.sortOrder),
          });
        }}
      />

      <EditModal
        open={!!editingBranch}
        title={`Modifier ${editingBranchData?.name ?? ''}`}
        fields={BRANCH_EDIT_FIELDS}
        values={editingBranchData ? branchToForm(editingBranchData) : {}}
        saving={updateBranchMut.isPending}
        onClose={() => setEditingBranch(null)}
        onSave={(values) => {
          if (!editingBranch) return;
          updateBranchMut.mutate({
            id: editingBranch,
            data: { name: String(values.name), description: String(values.description), color: String(values.color), sortOrder: Number(values.sortOrder) },
          });
        }}
      />

      <ConfirmDialog
        open={!!deletingBranch}
        title="Supprimer cette branche ?"
        message={deleteError || `La branche "${deletingBranch}" et tous ses talents seront supprimes.`}
        danger
        confirmLabel="Supprimer"
        onConfirm={() => { if (deletingBranch) deleteBranchMut.mutate({ id: deletingBranch }); }}
        onCancel={() => { setDeletingBranch(null); setDeleteError(null); }}
      />

      {/* ── Talent modals ── */}
      <EditModal
        open={!!creatingTalent}
        title="Nouveau talent"
        fields={talentFields(branchOptions, talentOptions)}
        values={defaultTalentForm(creatingTalent ?? undefined)}
        saving={createTalentMut.isPending}
        onClose={() => setCreatingTalent(null)}
        onSave={(values) => {
          createTalentMut.mutate({
            id: String(values.id),
            ...formToTalentData(values),
          });
        }}
      />

      <EditModal
        open={!!editingTalent}
        title={`Modifier ${editingTalentData?.name ?? ''}`}
        fields={talentFields(branchOptions, talentOptions).filter((f) => f.key !== 'id')}
        values={editingTalentData ? talentToForm(editingTalentData) : {}}
        saving={updateTalentMut.isPending}
        onClose={() => setEditingTalent(null)}
        onSave={(values) => {
          if (!editingTalent) return;
          updateTalentMut.mutate({
            id: editingTalent,
            data: formToTalentData(values),
          });
        }}
      />

      <ConfirmDialog
        open={!!deletingTalent}
        title="Supprimer ce talent ?"
        message={deleteError || `Le talent "${deletingTalent}" sera supprime.`}
        danger
        confirmLabel="Supprimer"
        onConfirm={() => { if (deletingTalent) deleteTalentMut.mutate({ id: deletingTalent }); }}
        onCancel={() => { setDeletingTalent(null); setDeleteError(null); }}
      />
    </div>
  );
}
