import { Star } from 'lucide-react';
import { getAssetUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

export interface PlanetFleetData {
  ships: { id: string; name: string; count: number; role: string | null; cargoCapacity: number }[];
  totalShips: number;
  totalFP: number;
  totalCargo: number;
}

interface EmpireFleetOverview {
  empireTotals: {
    shipsByType: { id: string; name: string; count: number; role: string | null }[];
    totalShips: number;
    totalFP: number;
    totalCargo: number;
  };
  flagship: { status: string; planetId: string | null; planetName: string | null } | null;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.floor(value));
}

export function EmpireFleetBanner({ overview }: { overview: EmpireFleetOverview }) {
  const { empireTotals, flagship } = overview;
  return (
    <section className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-sm p-3 lg:p-4 space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flotte stationnée</h2>
        <div className="flex items-center gap-3 text-[11px] lg:text-xs">
          <KpiInline label="Vsx" value={empireTotals.totalShips.toLocaleString('fr-FR')} />
          <KpiInline label="FP" value={formatCompact(empireTotals.totalFP)} accent="amber" />
          <KpiInline label="Cargo" value={formatCompact(empireTotals.totalCargo)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {flagship && flagship.status === 'active' && (
          <Chip
            icon={<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            value="1"
            label={flagship.planetName ? `Amiral · ${flagship.planetName}` : 'Amiral'}
            accent="amber"
          />
        )}
        {empireTotals.shipsByType.map((s) => (
          <Chip
            key={s.id}
            icon={
              <img
                src={getAssetUrl('ships', s.id, 'thumb')}
                alt=""
                className="h-5 w-5 rounded-sm object-cover"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            }
            value={s.count.toLocaleString('fr-FR')}
            label={s.name}
          />
        ))}
      </div>
    </section>
  );
}

function Chip({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent?: 'amber' }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md border bg-background/40 px-2 py-1',
        accent === 'amber' ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/60',
      )}
      title={label}
    >
      <div className="flex h-5 w-5 items-center justify-center shrink-0">{icon}</div>
      <span className={cn('font-mono text-sm font-bold leading-none', accent === 'amber' ? 'text-amber-400' : 'text-foreground')}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[120px]">{label}</span>
    </div>
  );
}

function KpiInline({ label, value, accent }: { label: string; value: string; accent?: 'amber' }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <strong className={cn('font-mono font-bold', accent === 'amber' ? 'text-amber-400' : 'text-foreground')}>
        {value}
      </strong>
    </span>
  );
}
