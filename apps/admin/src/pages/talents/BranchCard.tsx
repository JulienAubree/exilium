import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { EFFECT_TYPES, EFFECT_COLORS } from './constants';
import { effectParamsSummary } from './helpers';

export function BranchCard({
  branch,
  talents,
  isCollapsed,
  onToggleCollapse,
  onCreateTalent,
  onEditBranch,
  onDeleteBranch,
  onEditTalent,
  onDeleteTalent,
}: {
  branch: any;
  talents: any[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCreateTalent: () => void;
  onEditBranch: () => void;
  onDeleteBranch: () => void;
  onEditTalent: (id: string) => void;
  onDeleteTalent: (id: string) => void;
}) {
  return (
    <div className="admin-card mb-4">
      {/* Branch header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left flex-1"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: branch.color }}
          />
          <span className="font-semibold text-gray-100">{branch.name}</span>
          <span className="text-xs text-gray-500 font-mono">({branch.id})</span>
          <span className="text-xs text-gray-500">{talents.length} talent{talents.length > 1 ? 's' : ''}</span>
        </button>
        <div className="flex gap-1">
          <button
            onClick={onCreateTalent}
            className="admin-btn-ghost p-1.5 text-emerald-400"
            title="Ajouter un talent"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEditBranch} className="admin-btn-ghost p-1.5">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDeleteBranch}
            className="admin-btn-ghost p-1.5 text-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Talents table */}
      {!isCollapsed && (
        <div className="overflow-x-auto">
          {talents.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">Aucun talent dans cette branche.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Tier</th>
                  <th>Position</th>
                  <th>Rangs</th>
                  <th>Type effet</th>
                  <th>Parametres</th>
                  <th>Prerequis</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {talents.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-gray-400 text-xs">{t.id}</td>
                    <td className="font-medium">{t.name}</td>
                    <td className="text-center font-mono">{t.tier}</td>
                    <td className="text-xs text-gray-400">{t.position}</td>
                    <td className="text-center font-mono">{t.maxRanks}</td>
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${EFFECT_COLORS[t.effectType] ?? 'text-gray-400'}`}>
                        {EFFECT_TYPES.find((e) => e.value === t.effectType)?.label ?? t.effectType}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400 max-w-[200px] truncate" title={JSON.stringify(t.effectParams)}>
                      {effectParamsSummary(t.effectType, t.effectParams)}
                    </td>
                    <td className="text-xs text-gray-500 font-mono">{t.prerequisiteId ?? '—'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => onEditTalent(t.id)} className="admin-btn-ghost p-1.5">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTalent(t.id)}
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
          )}
        </div>
      )}
    </div>
  );
}
