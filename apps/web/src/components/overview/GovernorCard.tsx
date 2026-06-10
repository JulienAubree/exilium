import { UserCog } from 'lucide-react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useToastStore } from '@/stores/toast.store';

/**
 * Gouverneur v1 (chantier Empire §5.3) : déléguer la construction — quand la
 * file est libre, le gouverneur lance la priorité (énergie en déficit →
 * centrale ; stock saturé → entrepôt ; sinon la mine la plus basse).
 */
export function GovernorCard({ planetId, governor }: {
  planetId: string;
  governor: string | null;
}) {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const { data: gameConfig } = useGameConfig();
  const { data: progression } = trpc.empireProgression.get.useQuery();

  const mutation = trpc.planet.setGovernor.useMutation({
    onSuccess: (res) => {
      utils.planet.invalidate();
      addToast(
        res.governor
          ? 'Gouverneur nommé — il construira dès que la file sera libre.'
          : 'Gouverneur relevé de ses fonctions — gestion manuelle.',
        'success',
      );
    },
    onError: (e) => addToast(e.message, 'error'),
  });

  const unlockLevel = Number(gameConfig?.universe?.['governor_unlock_level']) || 8;
  const level = progression?.level ?? 1;
  const locked = level < unlockLevel;
  const active = governor === 'extraction';

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserCog className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
            Gouverneur
            {active && <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">directive Extraction</span>}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            {locked
              ? `Niveau d'empire ${unlockLevel} requis (actuel : ${level}).`
              : active
                ? 'File libre → il construit : centrale si déficit, entrepôt si stock saturé, sinon la mine la plus basse.'
                : 'Déléguez la construction : énergie, stockage et mines gérés automatiquement.'}
          </p>
        </div>
        <button
          type="button"
          disabled={locked || mutation.isPending}
          onClick={() => mutation.mutate({ planetId, governor: active ? null : 'extraction' })}
          className={cn(
            'shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast',
            locked
              ? 'border border-border text-muted-foreground-soft cursor-not-allowed'
              : active
                ? 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {active ? 'Relever' : 'Nommer'}
        </button>
      </div>
    </div>
  );
}
