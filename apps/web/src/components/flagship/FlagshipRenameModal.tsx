import { useState, useEffect } from 'react';
import { trpc } from '@/trpc';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

/**
 * Éditeur de nom et de description du vaisseau amiral.
 *
 * L'endpoint `flagship.rename` existe depuis toujours, mais son interface a
 * disparu avec `FlagshipIdentityCard` lors de la refonte 2 colonnes du
 * 2026-05-04 — sans que la capacité soit remplacée ailleurs. Comme `create()`
 * refuse de s'exécuter si un vaisseau amiral existe déjà, plus aucun joueur ne
 * pouvait changer le nom du sien.
 */
interface FlagshipRenameModalProps {
  open: boolean;
  onClose: () => void;
  currentName: string;
  currentDescription: string;
}

const NAME_MIN = 2;
const NAME_MAX = 32;
const DESCRIPTION_MAX = 256;

export function FlagshipRenameModal({
  open,
  onClose,
  currentName,
  currentDescription,
}: FlagshipRenameModalProps) {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  // Repart des valeurs courantes à chaque ouverture : sans ça, une modification
  // abandonnée réapparaîtrait pré-remplie à la réouverture.
  useEffect(() => {
    if (open) {
      setName(currentName);
      setDescription(currentDescription);
      setError(null);
    }
  }, [open, currentName, currentDescription]);

  const renameMutation = trpc.flagship.rename.useMutation({
    onSuccess: async () => {
      await utils.flagship.get.invalidate();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const trimmed = name.trim();
  const nameInvalid = trimmed.length < NAME_MIN || trimmed.length > NAME_MAX;

  const handleSubmit = () => {
    if (nameInvalid || renameMutation.isPending) return;
    renameMutation.mutate({
      name: trimmed,
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Renommer le vaisseau amiral">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="flagship-name" className="text-sm font-medium text-foreground">
            Nom
          </label>
          <input
            id="flagship-name"
            type="text"
            value={name}
            maxLength={NAME_MAX}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-md border border-violet-500/30 bg-background px-3 py-2 text-sm text-foreground focus:border-violet-400/60 focus:outline-none"
          />
          <p className="text-xs text-muted-foreground">
            {trimmed.length}/{NAME_MAX} — {NAME_MIN} caractères minimum.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="flagship-description" className="text-sm font-medium text-foreground">
            Description <span className="text-muted-foreground">(facultative)</span>
          </label>
          <textarea
            id="flagship-description"
            value={description}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-md border border-violet-500/30 bg-background px-3 py-2 text-sm text-foreground focus:border-violet-400/60 focus:outline-none"
          />
          <p className="text-xs text-muted-foreground">
            {description.length}/{DESCRIPTION_MAX}
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={nameInvalid || renameMutation.isPending}
          >
            {renameMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
