import { useState } from 'react';
import { ChevronDown, Landmark, TrendingDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GovernanceData {
  colonyCount: number;
  capacity: number;
  ipcLevel: number;
  overextend: number;
  harvestMalus: number;
  constructionMalus: number;
}

export function EmpireGovernanceBanner({ governance }: { governance: GovernanceData }) {
  const [expanded, setExpanded] = useState(false);

  const isOverextend = governance.overextend > 0;
  const isAtCapacity = governance.colonyCount === governance.capacity;
  const isSafe = governance.colonyCount < governance.capacity;

  const borderColor = isOverextend
    ? 'border-destructive/30'
    : isAtCapacity
      ? 'border-amber-500/30'
      : 'border-emerald-500/30';

  const bgColor = isOverextend
    ? 'bg-destructive/5'
    : isAtCapacity
      ? 'bg-amber-500/5'
      : 'bg-emerald-500/5';

  const statusColor = isOverextend
    ? 'text-destructive'
    : isAtCapacity
      ? 'text-amber-400'
      : 'text-emerald-400';

  const statusLabel = isOverextend
    ? 'Empire en surextension'
    : isAtCapacity
      ? 'Capacite maximale atteinte'
      : 'Gouvernance stable';

  const freeSlots = Math.max(0, governance.capacity - governance.colonyCount);

  return (
    <div className={cn('rounded-xl border transition-colors', borderColor, bgColor)}>
      {/* Clickable header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-3">
          <Landmark className={cn('h-4 w-4', statusColor)} />
          <div>
            <span className={cn('text-sm font-semibold', statusColor)}>{statusLabel}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {governance.colonyCount}/{governance.capacity} colonies
            </span>
          </div>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground transition-transform',
          expanded && 'rotate-180',
        )} />
      </button>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t border-border/30 px-4 py-3 space-y-3">
          {/* Status grid */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <InfoCard
              label="Centre de Pouvoir"
              value={`Niveau ${governance.ipcLevel}`}
              sub={`Capacite : ${governance.capacity} planete${governance.capacity > 1 ? 's' : ''}`}
              color="text-amber-400"
            />
            <InfoCard
              label="Colonies actives"
              value={String(governance.colonyCount)}
              sub={freeSlots > 0 ? `${freeSlots} slot${freeSlots > 1 ? 's' : ''} libre${freeSlots > 1 ? 's' : ''}` : 'Aucun slot libre'}
              color={isSafe ? 'text-emerald-400' : isAtCapacity ? 'text-amber-400' : 'text-destructive'}
            />
            <InfoCard
              label="Malus recolte"
              value={isOverextend ? `${Math.round(governance.harvestMalus * 100)}%` : 'Aucun'}
              icon={<TrendingDown className="h-3.5 w-3.5" />}
              color={isOverextend ? 'text-destructive' : 'text-emerald-400'}
            />
            <InfoCard
              label="Malus construction"
              value={isOverextend ? `+${Math.round(governance.constructionMalus * 100)}%` : 'Aucun'}
              icon={<Clock className="h-3.5 w-3.5" />}
              color={isOverextend ? 'text-destructive' : 'text-emerald-400'}
            />
          </div>

          {/* Explanation */}
          <div className="text-xs text-muted-foreground leading-relaxed">
            {isOverextend ? (
              <p>
                Votre empire depasse sa capacite de gouvernance de <span className="text-destructive font-medium">+{governance.overextend}</span>.
                {' '}Toutes vos colonies subissent des penalites de production et de construction.
                {' '}Ameliorez le <span className="text-amber-400 font-medium">Centre de Pouvoir Imperial</span> sur votre planete mere pour augmenter votre capacite.
              </p>
            ) : isAtCapacity ? (
              <p>
                Vous avez atteint votre capacite maximale. La prochaine colonie entrainera des penalites sur toutes vos colonies.
                {' '}Ameliorez le <span className="text-amber-400 font-medium">Centre de Pouvoir Imperial</span> avant de coloniser.
              </p>
            ) : (
              <p>
                Votre empire est stable. Vous pouvez coloniser <span className="text-emerald-400 font-medium">{freeSlots}</span> planete{freeSlots > 1 ? 's' : ''} supplementaire{freeSlots > 1 ? 's' : ''} sans penalite.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, sub, icon, color }: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-card/80 border border-border/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn('text-sm font-bold flex items-center gap-1.5', color)}>
        {icon}
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
