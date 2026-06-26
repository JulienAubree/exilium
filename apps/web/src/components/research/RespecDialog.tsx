/**
 * RespecDialog — confirmation du respec d'un fork de recherche.
 *
 * Affiche :
 * - Le coût en Exilium (calculé depuis la config univers + respecCount)
 * - La liste des recherches remises à 0
 * - Les boutons Confirmer / Annuler
 */
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useExilium } from '@/hooks/useExilium';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { ExiliumIcon } from '@/components/common/ExiliumIcon';
import { cn } from '@/lib/utils';
import type { ResearchItem, ForkChoices } from './research-tree.types';

interface RespecDialogProps {
  open: boolean;
  onClose: () => void;
  /** Fork dont on veut changer la voie. */
  forkId: string;
  /** Voie actuellement choisie (à quitter). */
  currentPath: string;
  /** Nouvelle voie désirée. */
  newPath: string;
  /** Toutes les recherches du fork (les deux voies). */
  forkItems: ResearchItem[];
  /** Choix courants du joueur (pour récupérer respecCount). */
  forkChoices: ForkChoices;
  /** Callback après respec réussi. */
  onSuccess: () => void;
}

export function RespecDialog({
  open,
  onClose,
  forkId,
  currentPath,
  newPath,
  forkItems,
  forkChoices,
  onSuccess,
}: RespecDialogProps) {
  const { data: gameConfig } = useGameConfig();
  const { data: exiliumData } = useExilium();
  const utils = trpc.useUtils();

  const respecMutation = trpc.research.respec.useMutation({
    onSuccess: () => {
      utils.research.list.invalidate();
      utils.exilium.getBalance.invalidate();
      onSuccess();
      onClose();
    },
  });

  const universe = gameConfig?.universe ?? {};
  const respecBase = Number(universe['research_respec_base']) || 5;
  const respecFactor = Number(universe['research_respec_factor']) || 2;
  const choice = forkChoices[forkId];
  const respecCount = choice?.respecCount ?? 0;
  const cost = Math.round(respecBase * Math.pow(respecFactor, respecCount));

  const balance = exiliumData?.balance ?? 0;
  const canAfford = balance >= cost;

  // Recherches qui seront remises à 0 (celles de l'ancienne voie)
  const resetsToZero = forkItems.filter(
    (r) => r.forkPath === currentPath && r.currentLevel > 0,
  );

  return (
    <Modal open={open} onClose={onClose} title="Respec de voie">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Vous allez changer de voie pour ce fork. La progression de l'ancienne voie sera{' '}
          <span className="text-foreground font-medium">remise à zéro</span>.
        </p>

        {/* Coût */}
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border p-3',
            canAfford ? 'border-purple-500/30 bg-purple-500/5' : 'border-red-500/30 bg-red-500/5',
          )}
        >
          <div className="flex items-center gap-2">
            <ExiliumIcon size={18} className="text-purple-400" />
            <span className="text-sm font-semibold">Coût Exilium</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('font-mono font-bold', canAfford ? 'text-purple-400' : 'text-red-400')}>
              {cost}
            </span>
            <span className="text-xs text-muted-foreground">/ {balance} disponible</span>
          </div>
        </div>

        {!canAfford && (
          <p className="text-xs text-red-400">
            Solde insuffisant. Gagnez plus d'Exilium via les quêtes journalières.
          </p>
        )}

        {/* Recherches remises à 0 */}
        {resetsToZero.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recherches remises à Niv. 0
            </p>
            {resetsToZero.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded bg-card/60 border border-border/40 px-3 py-1.5"
              >
                <span className="text-sm">{r.name}</span>
                <span className="text-xs font-mono text-red-400">
                  Niv. {r.currentLevel} → 0
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Aucune progression à perdre dans l'ancienne voie.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={respecMutation.isPending}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => respecMutation.mutate({ forkId, newPath })}
            disabled={!canAfford || respecMutation.isPending}
          >
            {respecMutation.isPending ? 'En cours…' : `Confirmer (${cost} Exilium)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
