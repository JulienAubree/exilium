import { Link } from 'react-router';
import { X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExiliumIcon } from '@/components/common/ExiliumIcon';
import { cn } from '@/lib/utils';

interface DroppedModule {
  id: string;
  name: string;
  rarity: string;
  image: string;
  isFinal?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  drops: DroppedModule[];
  resources: { minerai: number; silicium: number; hydrogene: number };
  exiliumRefunded: number;
  outcome: 'survived' | 'wiped' | 'forced_retreat';
}

const RARITY_TONE: Record<string, string> = {
  common: 'border-gray-400/50 bg-gray-500/10 text-gray-200',
  rare:   'border-blue-400/50 bg-blue-500/10 text-blue-200',
  epic:   'border-violet-400/60 bg-violet-500/15 text-violet-200',
};

const RARITY_LABEL: Record<string, string> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
};

export function AnomalyLootSummaryModal({
  open,
  onClose,
  drops,
  resources,
  exiliumRefunded,
  outcome,
}: Props) {
  if (!open) return null;
  const totalRes = resources.minerai + resources.silicium + resources.hydrogene;
  const title =
    outcome === 'wiped'
      ? 'Run terminée — wipe'
      : outcome === 'forced_retreat'
        ? 'Retour forcé — butin sauvé'
        : 'Butin de fin de run';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          {drops.length > 0 ? (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Modules récupérés
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {drops.map((m, i) => (
                  <div
                    key={`${m.id}-${i}`}
                    className={cn(
                      'rounded-md border-2 p-2 transition-all',
                      RARITY_TONE[m.rarity] ?? 'border-border/40 bg-card/30',
                      m.isFinal && 'ring-2 ring-yellow-500/40 shadow-md shadow-yellow-500/10',
                    )}
                  >
                    {m.image ? (
                      <img
                        src={`${m.image}-thumb.webp`}
                        alt={m.name}
                        className="w-full h-12 rounded object-cover mb-1"
                      />
                    ) : (
                      <div className="w-full h-12 rounded bg-card/40 mb-1 flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                        {m.name.slice(0, 3).toUpperCase()}
                      </div>
                    )}
                    <div className="text-xs font-semibold truncate" title={m.name}>
                      {m.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider opacity-70">
                      {RARITY_LABEL[m.rarity] ?? m.rarity}
                      {m.isFinal && ' · final'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : outcome === 'wiped' ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
              💀 Aucun module récupéré — votre flotte a été anéantie sans pouvoir extraire de données.
            </div>
          ) : null}

          {totalRes > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Ressources rapportées
              </h3>
              <div className="flex flex-wrap gap-3 text-sm font-mono tabular-nums">
                {resources.minerai > 0 && (
                  <span className="text-minerai">+{resources.minerai} M</span>
                )}
                {resources.silicium > 0 && (
                  <span className="text-silicium">+{resources.silicium} Si</span>
                )}
                {resources.hydrogene > 0 && (
                  <span className="text-hydrogene">+{resources.hydrogene} H</span>
                )}
              </div>
            </div>
          )}

          {exiliumRefunded > 0 && (
            <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-3 flex items-center gap-2 text-sm">
              <ExiliumIcon size={14} className="text-purple-400" />
              <span className="text-purple-300 font-semibold">+{exiliumRefunded}</span>
              <span className="text-muted-foreground text-xs">Exilium remboursé</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            <Link to="/flagship" onClick={onClose}>
              <Button>Voir mes modules →</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
