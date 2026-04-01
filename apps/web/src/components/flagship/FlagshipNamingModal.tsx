import { useState } from 'react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';

interface FlagshipNamingModalProps {
  open: boolean;
  onClose: () => void;
}

const NAME_REGEX = /^[\p{L}\p{N}\s\-']{2,32}$/u;

type HullId = 'combat' | 'industrial' | 'scientific';

const HULL_DATA: { id: HullId; name: string; description: string; bonuses: string[] }[] = [
  {
    id: 'combat',
    name: 'Coque de combat',
    description: 'Specialisee dans la guerre et la destruction.',
    bonuses: [
      '+6 blindage',
      '+2 attaques',
      '+8 armes',
      '-20% temps construction vaisseaux militaires',
    ],
  },
  {
    id: 'industrial',
    name: 'Coque industrielle',
    description: 'Optimisee pour la production et la collecte de ressources.',
    bonuses: [
      '-20% temps construction vaisseaux industriels',
      'Permet le minage et recyclage',
    ],
  },
  {
    id: 'scientific',
    name: 'Coque scientifique',
    description: 'Concue pour la recherche et le renseignement.',
    bonuses: [
      '-20% temps de recherche',
      'Mission de scan (espionnage)',
    ],
  },
];

const HULL_STYLES: Record<HullId, { border: string; ring: string; icon: string; accent: string }> = {
  combat: { border: 'border-red-500/60', ring: 'ring-red-500/30', icon: 'text-red-400', accent: 'text-red-400' },
  industrial: { border: 'border-amber-500/60', ring: 'ring-amber-500/30', icon: 'text-amber-400', accent: 'text-amber-400' },
  scientific: { border: 'border-cyan-500/60', ring: 'ring-cyan-500/30', icon: 'text-cyan-400', accent: 'text-cyan-400' },
};

export function FlagshipNamingModal({ open, onClose }: FlagshipNamingModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [selectedHull, setSelectedHull] = useState<HullId | null>(null);

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

  const isValid = name.length >= 2 && name.length <= 32 && NAME_REGEX.test(name) && selectedHull !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-amber-500/30 bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-amber-400">Votre vaisseau amiral</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nos ingenieurs ont remis ce vaisseau en etat. Choisissez sa coque et donnez-lui un nom, Commandant.
        </p>

        {/* Hull selection */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-foreground">
            Type de coque <span className="text-destructive">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {HULL_DATA.map((hull) => {
              const isSelected = selectedHull === hull.id;
              const styles = HULL_STYLES[hull.id];
              return (
                <button
                  key={hull.id}
                  type="button"
                  onClick={() => { setSelectedHull(hull.id); setError(''); }}
                  className={cn(
                    'rounded-lg border-2 bg-background p-3 text-left transition-all hover:bg-muted/30',
                    isSelected
                      ? cn(styles.border, 'ring-2', styles.ring)
                      : 'border-border hover:border-muted-foreground/30',
                  )}
                >
                  <div className={cn('text-sm font-semibold', isSelected ? styles.accent : 'text-foreground')}>
                    {hull.name}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{hull.description}</p>
                  <ul className="mt-2 space-y-0.5">
                    {hull.bonuses.map((bonus, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <span className={cn('mt-0.5 shrink-0', isSelected ? styles.icon : 'text-muted-foreground/60')}>+</span>
                        <span>{bonus}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

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
          onClick={() => createMutation.mutate({ name, description: description || undefined, hullId: selectedHull! })}
          disabled={!isValid || createMutation.isPending}
          className="mt-4 w-full rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creation...' : 'Baptiser le vaisseau'}
        </button>
      </div>
    </div>
  );
}
