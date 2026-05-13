import { useState, useMemo } from 'react';
import { Bookmark, Plus, Trash2, Check, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { trpc } from '@/trpc';
import { useToastStore } from '@/stores/toast.store';
import { cn } from '@/lib/utils';

interface Props {
  selectedShips: Record<string, number>;
  onLoad: (ships: Record<string, number>) => void;
}

export function FleetPresetBar({ selectedShips, onLoad }: Props) {
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const { data: presets = [] } = trpc.fleetPreset.list.useQuery();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [overwriteId, setOverwriteId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => Object.values(selectedShips).filter((c) => c > 0).length,
    [selectedShips],
  );

  const createMutation = trpc.fleetPreset.create.useMutation({
    onSuccess: () => {
      utils.fleetPreset.list.invalidate();
      addToast('Preset sauvegardé', 'success');
      setSaveOpen(false);
      setSaveName('');
      setOverwriteId(null);
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const updateMutation = trpc.fleetPreset.update.useMutation({
    onSuccess: () => {
      utils.fleetPreset.list.invalidate();
      addToast('Preset mis à jour', 'success');
      setSaveOpen(false);
      setSaveName('');
      setOverwriteId(null);
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const deleteMutation = trpc.fleetPreset.delete.useMutation({
    onSuccess: () => {
      utils.fleetPreset.list.invalidate();
      addToast('Preset supprimé', 'success');
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const handleSaveClick = () => {
    if (activeCount === 0) {
      addToast('Sélectionne au moins un vaisseau avant de sauvegarder.', 'error');
      return;
    }
    setSaveName('');
    setOverwriteId(null);
    setSaveOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = saveName.trim();
    if (trimmed.length === 0) return;

    const existing = presets.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (existing && overwriteId !== existing.id) {
      setOverwriteId(existing.id);
      return;
    }

    const cleanShips = Object.fromEntries(
      Object.entries(selectedShips).filter(([, c]) => c > 0),
    );

    if (existing) {
      updateMutation.mutate({ id: existing.id, name: trimmed, ships: cleanShips });
    } else {
      createMutation.mutate({ name: trimmed, ships: cleanShips });
    }
  };

  const handleLoad = (preset: (typeof presets)[number]) => {
    onLoad(preset.ships);
    setPickerOpen(false);
    addToast(`Preset « ${preset.name} » chargé`, 'success');
  };

  const handleDelete = (preset: (typeof presets)[number]) => {
    if (!confirm(`Supprimer le preset « ${preset.name} » ?`)) return;
    deleteMutation.mutate({ id: preset.id });
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-card/80 hover:text-foreground transition-colors"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Presets {presets.length > 0 && <span className="text-muted-foreground">({presets.length})</span>}
      </button>
      <button
        type="button"
        onClick={handleSaveClick}
        disabled={activeCount === 0}
        title={activeCount === 0 ? 'Sélectionne des vaisseaux pour sauvegarder' : 'Sauvegarder cette composition'}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-card/80 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="h-3.5 w-3.5" />
        Sauvegarder
      </button>

      {/* Picker modal */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Charger un preset">
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Aucun preset enregistré. Compose une flotte puis clique sur « Sauvegarder ».
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {presets.map((preset) => {
              const totalShips = Object.values(preset.ships).reduce((a, b) => a + b, 0);
              const kinds = Object.keys(preset.ships).length;
              return (
                <li
                  key={preset.id}
                  className="flex items-center gap-2 rounded-md border border-border/60 bg-card/30 p-2 hover:bg-card/60 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleLoad(preset)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-sm font-medium text-foreground truncate">{preset.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {totalShips.toLocaleString()} vaisseaux · {kinds} type{kinds > 1 ? 's' : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(preset)}
                    aria-label="Supprimer le preset"
                    className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      {/* Save modal */}
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Sauvegarder la composition">
        <form onSubmit={handleSaveSubmit} className="space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Nom du preset
            </label>
            <Input
              autoFocus
              maxLength={64}
              value={saveName}
              onChange={(e) => {
                setSaveName(e.target.value);
                if (overwriteId) setOverwriteId(null);
              }}
              placeholder="Ex: Raid Zecharia, Minage T3, Flotte de reco..."
              className="h-9"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            {activeCount} type{activeCount > 1 ? 's' : ''} de vaisseau,{' '}
            {Object.values(selectedShips).reduce((a, b) => a + b, 0).toLocaleString()} unités au total.
          </div>

          {overwriteId && (
            <div className="rounded-md border border-amber-500/40 bg-amber-950/30 p-2.5 text-xs text-amber-200">
              Un preset porte déjà ce nom. Clique à nouveau sur « Sauvegarder » pour l'écraser.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs text-foreground/80 hover:bg-card/80"
            >
              <X className="h-3.5 w-3.5" />
              Annuler
            </button>
            <button
              type="submit"
              disabled={saveName.trim().length === 0 || submitting}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {overwriteId ? 'Écraser' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
