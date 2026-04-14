import { useState } from 'react';
import { Globe, Rocket, ShieldAlert, Landmark, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon } from '@/components/common/ResourceIcons';

interface GovernanceData {
  colonyCount: number;
  capacity: number;
  overextend: number;
  harvestMalus: number;
  constructionMalus: number;
}

interface PlanetData {
  name: string;
  mineraiPerHour?: number;
  siliciumPerHour?: number;
  hydrogenePerHour?: number;
  status?: string;
  outboundFleets?: { count: number; earliestArrival: string } | null;
  inboundAttack?: { arrivalTime: string } | null;
}

interface EmpireKpiBarProps {
  totalRates: { mineraiPerHour: number; siliciumPerHour: number; hydrogenePerHour: number };
  planetCount: number;
  activeFleetCount: number;
  inboundAttackCount: number;
  governance?: GovernanceData | null;
  planets?: PlanetData[];
}

function formatRate(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.floor(value));
}

type PanelId = 'minerai' | 'silicium' | 'hydrogene' | 'planets' | 'governance' | 'fleets' | null;

export function EmpireKpiBar({ totalRates, planetCount, activeFleetCount, inboundAttackCount, governance, planets }: EmpireKpiBarProps) {
  const [openPanel, setOpenPanel] = useState<PanelId>(null);

  const toggle = (id: PanelId) => setOpenPanel((prev) => (prev === id ? null : id));

  const govColor = governance
    ? governance.colonyCount > governance.capacity
      ? 'text-destructive'
      : governance.colonyCount === governance.capacity
        ? 'text-amber-400'
        : 'text-emerald-400'
    : 'text-foreground';

  const govIconBg = governance
    ? governance.colonyCount > governance.capacity
      ? 'bg-destructive/10'
      : governance.colonyCount === governance.capacity
        ? 'bg-amber-400/10'
        : 'bg-emerald-400/10'
    : 'bg-muted';

  const activePlanets = planets?.filter(p => p.status !== 'colonizing') ?? [];

  return (
    <div className="rounded-xl border border-border/30 bg-card/60 overflow-hidden">
      {/* KPI row — single line, compact */}
      <div className="flex items-center justify-between gap-1 px-2 py-2 lg:gap-3 lg:px-4 overflow-x-auto">
        <Kpi
          iconNode={<MineraiIcon size={14} className="text-minerai" />}
          color="text-minerai"
          value={`${formatRate(totalRates.mineraiPerHour)}/h`}
          label="Fe"
          active={openPanel === 'minerai'}
          onClick={() => toggle('minerai')}
        />
        <Kpi
          iconNode={<SiliciumIcon size={14} className="text-silicium" />}
          color="text-silicium"
          value={`${formatRate(totalRates.siliciumPerHour)}/h`}
          label="Si"
          active={openPanel === 'silicium'}
          onClick={() => toggle('silicium')}
        />
        <Kpi
          iconNode={<HydrogeneIcon size={14} className="text-hydrogene" />}
          color="text-hydrogene"
          value={`${formatRate(totalRates.hydrogenePerHour)}/h`}
          label="H"
          active={openPanel === 'hydrogene'}
          onClick={() => toggle('hydrogene')}
        />
        <div className="hidden h-5 w-px bg-border/40 lg:block" />
        <Kpi
          iconNode={<Globe className="h-3.5 w-3.5 text-foreground" />}
          color="text-foreground"
          value={String(planetCount)}
          label="Planetes"
          active={openPanel === 'planets'}
          onClick={() => toggle('planets')}
        />
        {governance && (
          <Kpi
            iconNode={<Landmark className={cn('h-3.5 w-3.5', govColor)} />}
            color={govColor}
            value={`${governance.colonyCount}/${governance.capacity}`}
            label="Gouv."
            active={openPanel === 'governance'}
            onClick={() => toggle('governance')}
          />
        )}
        <Kpi
          iconNode={<Rocket className="h-3.5 w-3.5 text-primary" />}
          color="text-primary"
          value={String(activeFleetCount)}
          label="Flottes"
          active={openPanel === 'fleets'}
          onClick={() => toggle('fleets')}
        />
        {inboundAttackCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive animate-pulse">
            <ShieldAlert className="h-3.5 w-3.5" />
            {inboundAttackCount}
          </div>
        )}
      </div>

      {/* Expandable panels */}
      {openPanel && (
        <div className="border-t border-border/30 px-4 py-3">
          {(openPanel === 'minerai' || openPanel === 'silicium' || openPanel === 'hydrogene') && (
            <ResourcePanel
              resource={openPanel}
              planets={activePlanets}
              total={
                openPanel === 'minerai' ? totalRates.mineraiPerHour
                  : openPanel === 'silicium' ? totalRates.siliciumPerHour
                    : totalRates.hydrogenePerHour
              }
            />
          )}
          {openPanel === 'planets' && <PlanetsPanel planets={planets ?? []} />}
          {openPanel === 'governance' && governance && <GovernancePanel governance={governance} />}
          {openPanel === 'fleets' && <FleetsPanel planets={planets ?? []} totalFleets={activeFleetCount} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI pill (clickable)
// ---------------------------------------------------------------------------

function Kpi({ iconNode, color, value, label, active, onClick }: {
  iconNode: React.ReactNode;
  color: string;
  value: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors shrink-0',
        active ? 'bg-accent/60 ring-1 ring-primary/30' : 'hover:bg-accent/30',
      )}
    >
      {iconNode}
      <span className={cn('text-xs font-bold', color)}>{value}</span>
      <span className="text-[9px] uppercase text-muted-foreground hidden lg:inline">{label}</span>
      <ChevronDown className={cn(
        'h-2.5 w-2.5 text-muted-foreground/40 transition-transform',
        active && 'rotate-180',
      )} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Resource breakdown panel
// ---------------------------------------------------------------------------

function ResourcePanel({ resource, planets, total }: {
  resource: 'minerai' | 'silicium' | 'hydrogene';
  planets: PlanetData[];
  total: number;
}) {
  const colorMap = { minerai: 'text-minerai', silicium: 'text-silicium', hydrogene: 'text-hydrogene' };
  const rateKey = resource === 'minerai' ? 'mineraiPerHour' : resource === 'silicium' ? 'siliciumPerHour' : 'hydrogenePerHour';
  const label = resource === 'minerai' ? 'Minerai' : resource === 'silicium' ? 'Silicium' : 'Hydrogene';

  const sorted = [...planets].sort((a, b) => (b[rateKey] ?? 0) - (a[rateKey] ?? 0));

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Production {label} par planete
      </div>
      <div className="space-y-1">
        {sorted.map((p) => {
          const rate = p[rateKey] ?? 0;
          const pct = total > 0 ? (rate / total) * 100 : 0;
          return (
            <div key={p.name} className="flex items-center gap-2 text-xs">
              <span className="w-24 truncate text-foreground font-medium">{p.name}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', resource === 'minerai' ? 'bg-minerai' : resource === 'silicium' ? 'bg-silicium' : 'bg-hydrogene')}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <span className={cn('w-16 text-right font-mono text-[11px]', colorMap[resource])}>
                {formatRate(rate)}/h
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end text-xs text-muted-foreground pt-1 border-t border-border/30">
        Total : <span className={cn('font-semibold ml-1', colorMap[resource])}>{formatRate(total)}/h</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planets panel
// ---------------------------------------------------------------------------

function PlanetsPanel({ planets }: { planets: PlanetData[] }) {
  const active = planets.filter(p => p.status !== 'colonizing');
  const colonizing = planets.filter(p => p.status === 'colonizing');

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {active.length} planete{active.length > 1 ? 's' : ''} active{active.length > 1 ? 's' : ''}
        {colonizing.length > 0 && `, ${colonizing.length} en colonisation`}
      </div>
      <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
        {planets.map((p) => (
          <div key={p.name} className={cn(
            'rounded-lg border px-3 py-1.5 text-xs',
            p.status === 'colonizing' ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/30 bg-card/50',
          )}>
            <div className="font-medium text-foreground truncate">{p.name}</div>
            <div className="text-muted-foreground text-[10px]">
              {p.status === 'colonizing' ? 'Colonisation en cours' : `${formatRate(p.mineraiPerHour ?? 0)} / ${formatRate(p.siliciumPerHour ?? 0)} / ${formatRate(p.hydrogenePerHour ?? 0)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Governance panel
// ---------------------------------------------------------------------------

function GovernancePanel({ governance }: { governance: GovernanceData }) {
  const isOver = governance.overextend > 0;
  const freeSlots = Math.max(0, governance.capacity - governance.colonyCount);

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Gouvernance imperiale
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MiniCard label="Capacite" value={`${governance.capacity} planete${governance.capacity > 1 ? 's' : ''}`} color="text-amber-400" />
        <MiniCard label="Colonies" value={String(governance.colonyCount)} color={isOver ? 'text-destructive' : 'text-emerald-400'} />
        <MiniCard label="Malus recolte" value={isOver ? `-${Math.round(governance.harvestMalus * 100)}%` : 'Aucun'} color={isOver ? 'text-destructive' : 'text-emerald-400'} />
        <MiniCard label="Malus construction" value={isOver ? `+${Math.round(governance.constructionMalus * 100)}%` : 'Aucun'} color={isOver ? 'text-destructive' : 'text-emerald-400'} />
      </div>
      <div className="text-xs text-muted-foreground">
        {isOver
          ? `Depassement de +${governance.overextend}. Ameliorez le Centre de Pouvoir Imperial pour reduire les penalites.`
          : freeSlots > 0
            ? `${freeSlots} slot${freeSlots > 1 ? 's' : ''} disponible${freeSlots > 1 ? 's' : ''} pour coloniser sans penalite.`
            : 'Capacite atteinte. Prochaine colonie = penalites sur toutes les colonies.'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fleets panel
// ---------------------------------------------------------------------------

function FleetsPanel({ planets, totalFleets }: { planets: PlanetData[]; totalFleets: number }) {
  const withFleets = planets.filter(p => p.outboundFleets && p.outboundFleets.count > 0);
  const underAttack = planets.filter(p => p.inboundAttack);

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {totalFleets} flotte{totalFleets > 1 ? 's' : ''} en vol
      </div>
      {withFleets.length > 0 ? (
        <div className="space-y-1">
          {withFleets.map((p) => (
            <div key={p.name} className="flex items-center justify-between text-xs rounded-lg border border-border/30 bg-card/50 px-3 py-1.5">
              <span className="font-medium text-foreground">{p.name}</span>
              <span className="text-primary font-mono">{p.outboundFleets!.count} flotte{p.outboundFleets!.count > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Aucune flotte en vol depuis vos planetes.</div>
      )}
      {underAttack.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border/30">
          <div className="text-[10px] uppercase tracking-wider text-destructive font-semibold">
            Planetes attaquees
          </div>
          {underAttack.map((p) => (
            <div key={p.name} className="flex items-center justify-between text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5">
              <span className="font-medium">{p.name}</span>
              <span className="font-mono">Attaque imminente</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini card helper
// ---------------------------------------------------------------------------

function MiniCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/50 px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-bold', color)}>{value}</div>
    </div>
  );
}
