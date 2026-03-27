import { useState } from 'react';
import { trpc } from '@/trpc';

interface FlagshipNamingModalProps {
  open: boolean;
  onClose: () => void;
}

const NAME_REGEX = /^[\p{L}\p{N}\s\-']{2,32}$/u;

export function FlagshipNamingModal({ open, onClose }: FlagshipNamingModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const utils = trpc.useUtils();
  const createMutation = trpc.flagship.create.useMutation({
    onSuccess: () => {
      utils.tutorial.getCurrent.invalidate();
      utils.flagship.get.invalidate();
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  if (!open) return null;

  const isValid = name.length >= 2 && name.length <= 32 && NAME_REGEX.test(name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-card p-6 shadow-xl">
        <h2 className="text-lg font-bold text-amber-400">Votre vaisseau amiral</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nos ingenieurs ont remis ce vaisseau en etat. Donnez-lui un nom, Commandant.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground">
              Nom <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Ex : Odyssee, Nemesis, Aurore..."
              maxLength={32}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-[10px] text-muted-foreground">{name.length}/32 caracteres</span>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Description (optionnelle)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={256}
              rows={2}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-[10px] text-muted-foreground">{description.length}/256 caracteres</span>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <button
          onClick={() => createMutation.mutate({ name, description: description || undefined })}
          disabled={!isValid || createMutation.isPending}
          className="mt-4 w-full rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creation...' : 'Baptiser le vaisseau'}
        </button>
      </div>
    </div>
  );
}
