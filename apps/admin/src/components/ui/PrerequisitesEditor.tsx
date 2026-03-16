import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

export interface BuildingPrereq {
  requiredBuildingId: string;
  requiredLevel: number;
}

export interface MixedPrereq {
  requiredBuildingId?: string;
  requiredResearchId?: string;
  requiredLevel: number;
}

interface PrerequisitesEditorProps {
  open: boolean;
  title: string;
  mode: 'building' | 'mixed';
  /** Current prerequisites */
  buildingPrereqs?: BuildingPrereq[];
  mixedPrereqs?: MixedPrereq[];
  /** Available entities for dropdown */
  buildings: { id: string; name: string }[];
  research?: { id: string; name: string }[];
  onSave: (prereqs: BuildingPrereq[] | MixedPrereq[]) => void;
  onClose: () => void;
  saving?: boolean;
}

export function PrerequisitesEditor({
  open,
  title,
  mode,
  buildingPrereqs,
  mixedPrereqs,
  buildings,
  research,
  onSave,
  onClose,
  saving,
}: PrerequisitesEditorProps) {
  const [items, setItems] = useState<MixedPrereq[]>([]);
  const [addType, setAddType] = useState<'building' | 'research'>('building');
  const [addId, setAddId] = useState('');
  const [addLevel, setAddLevel] = useState(1);

  useEffect(() => {
    if (mode === 'building' && buildingPrereqs) {
      setItems(buildingPrereqs.map((p) => ({ requiredBuildingId: p.requiredBuildingId, requiredLevel: p.requiredLevel })));
    } else if (mode === 'mixed' && mixedPrereqs) {
      setItems([...mixedPrereqs]);
    }
  }, [buildingPrereqs, mixedPrereqs, mode]);

  useEffect(() => {
    if (open) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose]);

  if (!open) return null;

  const handleAdd = () => {
    if (!addId) return;
    // Prevent duplicate
    const exists = items.some((i) =>
      addType === 'building' ? i.requiredBuildingId === addId : i.requiredResearchId === addId,
    );
    if (exists) return;

    const newItem: MixedPrereq =
      addType === 'building'
        ? { requiredBuildingId: addId, requiredLevel: addLevel }
        : { requiredResearchId: addId, requiredLevel: addLevel };

    setItems([...items, newItem]);
    setAddId('');
    setAddLevel(1);
  };

  const handleRemove = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleLevelChange = (index: number, level: number) => {
    setItems(items.map((item, i) => (i === index ? { ...item, requiredLevel: level } : item)));
  };

  const handleSave = () => {
    if (mode === 'building') {
      onSave(
        items
          .filter((i) => i.requiredBuildingId)
          .map((i) => ({ requiredBuildingId: i.requiredBuildingId!, requiredLevel: i.requiredLevel })),
      );
    } else {
      onSave(items);
    }
  };

  const getName = (item: MixedPrereq): string => {
    if (item.requiredBuildingId) {
      return buildings.find((b) => b.id === item.requiredBuildingId)?.name ?? item.requiredBuildingId;
    }
    if (item.requiredResearchId) {
      return research?.find((r) => r.id === item.requiredResearchId)?.name ?? item.requiredResearchId;
    }
    return '?';
  };

  const getTypeLabel = (item: MixedPrereq): string => {
    if (item.requiredBuildingId) return 'Bâtiment';
    if (item.requiredResearchId) return 'Recherche';
    return '?';
  };

  const currentOptions = addType === 'building' ? buildings : (research ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="admin-card p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-100">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current prerequisites list */}
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">Aucun prérequis</p>
        ) : (
          <div className="space-y-2 mb-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded bg-panel-hover/50 border border-panel-border/50"
              >
                {mode === 'mixed' && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-hull-900/50 text-hull-400 shrink-0">
                    {getTypeLabel(item)}
                  </span>
                )}
                <span className="text-sm text-gray-200 flex-1 truncate">{getName(item)}</span>
                <span className="text-xs text-gray-500 shrink-0">Niv.</span>
                <input
                  type="number"
                  min={1}
                  value={item.requiredLevel}
                  onChange={(e) => handleLevelChange(index, Math.max(1, Number(e.target.value)))}
                  className="admin-input w-16 text-center text-sm"
                />
                <button
                  onClick={() => handleRemove(index)}
                  className="admin-btn-ghost p-1 text-red-400 hover:text-red-300 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new prerequisite */}
        <div className="border-t border-panel-border/50 pt-4">
          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Ajouter un prérequis</div>
          <div className="flex items-end gap-2">
            {mode === 'mixed' && (
              <div className="shrink-0">
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={addType}
                  onChange={(e) => {
                    setAddType(e.target.value as 'building' | 'research');
                    setAddId('');
                  }}
                  className="admin-input text-sm"
                >
                  <option value="building">Bâtiment</option>
                  <option value="research">Recherche</option>
                </select>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 mb-1">
                {mode === 'building' ? 'Bâtiment' : addType === 'building' ? 'Bâtiment' : 'Recherche'}
              </label>
              <select value={addId} onChange={(e) => setAddId(e.target.value)} className="admin-input text-sm w-full">
                <option value="">-- Choisir --</option>
                {currentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="shrink-0">
              <label className="block text-xs text-gray-500 mb-1">Niveau</label>
              <input
                type="number"
                min={1}
                value={addLevel}
                onChange={(e) => setAddLevel(Math.max(1, Number(e.target.value)))}
                className="admin-input w-16 text-center text-sm"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!addId}
              className="admin-btn-ghost p-2 text-hull-400 hover:text-hull-300 disabled:opacity-30 shrink-0"
              title="Ajouter"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="admin-btn-ghost">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving} className="admin-btn-primary">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}
