import { useState } from 'react';
import { Link } from 'react-router';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@exilium/api/trpc';
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Skull,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { Button } from '@/components/ui/button';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { AnomalyIcon } from '@/lib/icons';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

type HistoryDetailed = inferRouterOutputs<AppRouter>['anomaly']['historyDetailed'];
type Run = HistoryDetailed['runs'][number];
type RunBoss = Run['bossesDefeated'][number];
type Stats = HistoryDetailed['stats'];

type StatusFilter = 'all' | 'completed' | 'wiped';

const PAGE_SIZE = 20;

const BUFF_LABELS: Record<string, string> = {
  damage_boost: 'Dégâts',
  hull_repair: 'Réparation',
  shield_amp: 'Bouclier',
  armor_amp: 'Blindage',
  extra_charge: 'Charges épiques',
  module_unlock: 'Module débloqué',
};

export default function AnomalyHistory() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data, isLoading } = trpc.anomaly.historyDetailed.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <CardGridSkeleton count={3} />
      </div>
    );
  }

  if (!data) return null;
  const filteredRuns =
    statusFilter === 'all'
      ? data.runs
      : data.runs.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-4 lg:space-y-6 pb-6">
      <HistoryHero stats={data.stats} />

      <div className="px-4 lg:px-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <StatusChip
              active={statusFilter === 'all'}
              label="Toutes"
              count={data.stats.totalRuns}
              onClick={() => setStatusFilter('all')}
            />
            <StatusChip
              active={statusFilter === 'completed'}
              label="Réussies"
              count={data.stats.completed}
              tone="emerald"
              onClick={() => setStatusFilter('completed')}
            />
            <StatusChip
              active={statusFilter === 'wiped'}
              label="Wipes"
              count={data.stats.wiped}
              tone="rose"
              onClick={() => setStatusFilter('wiped')}
            />
          </div>
          <Link to="/anomalies">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour aux anomalies
            </Button>
          </Link>
        </div>

        {filteredRuns.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card/30 p-12 text-center text-sm text-muted-foreground">
            Aucune run dans ce filtre.
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredRuns.map((run) => (
              <li key={run.id}>
                <RunCard run={run} />
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          hasMore={data.hasMore}
          total={data.total}
          pageSize={PAGE_SIZE}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function HistoryHero({ stats }: { stats: Stats }) {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/70 via-slate-950 to-indigo-950/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      <div className="relative px-5 pt-8 pb-6 lg:px-8 lg:pt-10 lg:pb-8 space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full border-2 border-violet-500/30 bg-violet-950/50 shadow-lg shadow-violet-500/15">
            <AnomalyIcon className="h-9 w-9 lg:h-11 lg:w-11 text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-foreground">
              Historique des Anomalies
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Toutes vos plongées dans le vide quantique, archivées.
            </p>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <StatTile
            label="Runs totales"
            value={String(stats.totalRuns)}
            tone="violet"
          />
          <StatTile
            label="Réussies"
            value={String(stats.completed)}
            tone="emerald"
          />
          <StatTile
            label="Wipes"
            value={String(stats.wiped)}
            tone="rose"
          />
          <StatTile
            label="Profondeur max"
            value={String(stats.maxDepthReached).padStart(2, '0')}
            tone="amber"
          />
          <StatTile
            label="Palier max"
            value={String(stats.maxTierReached)}
            tone="amber"
          />
          <StatTile
            label="Boss vaincus"
            value={String(stats.totalBossDefeated)}
            tone="rose"
          />
        </div>

        {/* Resources */}
        <div className="grid grid-cols-3 gap-2.5">
          <ResourceTile label="Minerai" value={stats.totalMinerai} tone="orange" />
          <ResourceTile label="Silicium" value={stats.totalSilicium} tone="cyan" />
          <ResourceTile label="Hydrogène" value={stats.totalHydrogene} tone="violet" />
        </div>
      </div>
    </div>
  );
}

const TILE_TONE: Record<string, { border: string; bg: string; text: string }> = {
  violet: { border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-200' },
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-200' },
  rose: { border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-200' },
  amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-200' },
  orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-200' },
  cyan: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-200' },
};

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof TILE_TONE;
}) {
  const t = TILE_TONE[tone];
  return (
    <div className={cn('rounded-lg border p-3', t.border, t.bg)}>
      <div className={cn('text-2xl font-bold tabular-nums', t.text)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );
}

function ResourceTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof TILE_TONE;
}) {
  const t = TILE_TONE[tone];
  return (
    <div className={cn('rounded-lg border p-3 flex items-center justify-between', t.border, t.bg)}>
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </span>
      <span className={cn('text-base font-bold tabular-nums', t.text)}>
        +{formatNumber(value)}
      </span>
    </div>
  );
}

// ─── Filters ────────────────────────────────────────────────────────────────

function StatusChip({
  active,
  label,
  count,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone?: 'emerald' | 'rose';
  onClick: () => void;
}) {
  const accentClass =
    tone === 'emerald'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : tone === 'rose'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
        : 'border-violet-500/40 bg-violet-500/10 text-violet-300';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
        active
          ? accentClass
          : 'border-border/40 bg-card/30 text-muted-foreground hover:bg-card/60',
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums opacity-80">{count}</span>
    </button>
  );
}

// ─── Run card (expandable) ────────────────────────────────────────────────

function RunCard({ run }: { run: Run }) {
  const [open, setOpen] = useState(false);
  const totalLoot = run.lootMinerai + run.lootSilicium + run.lootHydrogene;
  const totalShips = Object.values(run.lootShips).reduce((s, n) => s + n, 0);
  const date = run.completedAt ? new Date(run.completedAt) : null;

  let icon: React.ReactNode;
  let label: string;
  let tone: 'emerald' | 'rose' | 'amber';
  if (run.status === 'wiped') {
    icon = <Skull className="h-5 w-5 text-rose-400" />;
    label = 'Wipe';
    tone = 'rose';
  } else if (run.currentDepth >= 5) {
    icon = <Trophy className="h-5 w-5 text-yellow-400" />;
    label = 'Run réussie';
    tone = 'emerald';
  } else {
    icon = <X className="h-5 w-5 text-amber-400" />;
    label = 'Abandon précoce';
    tone = 'amber';
  }

  const toneClass =
    tone === 'rose'
      ? 'border-rose-500/30'
      : tone === 'emerald'
        ? 'border-emerald-500/30'
        : 'border-amber-500/30';

  return (
    <div className={cn('rounded-xl border bg-card/30 overflow-hidden', toneClass)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-card/40 transition-colors text-left"
      >
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground/90">{label}</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              palier {run.tier} · prof {String(run.currentDepth).padStart(2, '0')}
            </span>
            {date && (
              <span className="text-[10px] font-mono text-muted-foreground/70">
                · {date.toLocaleDateString('fr-FR')} {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
            {totalLoot > 0 ? `+${formatNumber(totalLoot)} ressources` : 'Aucune ressource'}
            {totalShips > 0 ? ` · +${totalShips} vaisseaux` : ''}
            {run.bossesDefeated.length > 0 ? ` · ${run.bossesDefeated.length} boss vaincu${run.bossesDefeated.length > 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <RunDetail run={run} />}
    </div>
  );
}

// ─── Run detail ───────────────────────────────────────────────────────────

function RunDetail({ run }: { run: Run }) {
  const { data: gameConfig } = useGameConfig();

  return (
    <div className="border-t border-border/30 px-4 py-4 space-y-4">
      {/* Resources */}
      <section>
        <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">
          Ressources gagnées
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat
            label="Minerai"
            value={`+${formatNumber(run.lootMinerai)}`}
            tone="orange"
          />
          <MiniStat
            label="Silicium"
            value={`+${formatNumber(run.lootSilicium)}`}
            tone="cyan"
          />
          <MiniStat
            label="Hydrogène"
            value={`+${formatNumber(run.lootHydrogene)}`}
            tone="violet"
          />
        </div>
      </section>

      {/* Ships */}
      {Object.keys(run.lootShips).length > 0 && (
        <section>
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">
            Vaisseaux récupérés
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(run.lootShips).map(([shipId, count]) => {
              const def = gameConfig?.ships?.[shipId];
              return (
                <span
                  key={shipId}
                  className="inline-flex items-center gap-1.5 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px]"
                >
                  <span className="text-cyan-200 font-semibold">{def?.name ?? shipId}</span>
                  <span className="text-cyan-300/80 tabular-nums">×{count}</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Boss vaincus */}
      {run.bossesDefeated.length > 0 && (
        <section>
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
            <Skull className="h-3 w-3 text-rose-400" />
            Boss vaincus ({run.bossesDefeated.length})
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {run.bossesDefeated.map((boss) => (
              <BossCard key={boss.id} boss={boss} />
            ))}
          </div>
        </section>
      )}

      {/* Buffs actifs */}
      {run.activeBuffs.length > 0 && (
        <section>
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Buffs en fin de run ({run.activeBuffs.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {run.activeBuffs.map((buff, i) => (
              <span
                key={`${buff.sourceBossId}-${i}`}
                className="inline-flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px]"
              >
                <span className="text-amber-200 font-semibold">
                  {BUFF_LABELS[buff.type] ?? buff.type}
                </span>
                <span className="text-amber-300/80 tabular-nums">
                  +{Math.round(buff.magnitude * 100)}%
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Event log */}
      {run.eventLog.length > 0 && (
        <section>
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">
            Événements résolus ({run.eventLog.length})
          </h4>
          <ul className="space-y-1 text-[11px] text-muted-foreground/80">
            {run.eventLog.map((evt, i) => (
              <li
                key={`${evt.eventId}-${i}`}
                className="flex items-center gap-2 rounded border border-border/30 bg-card/30 px-2 py-1"
              >
                <span className="font-mono tabular-nums text-muted-foreground/60">
                  prof {String(evt.depth).padStart(2, '0')}
                </span>
                <span className="text-foreground/80 truncate">{evt.eventId}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground/60">
                  choix {evt.choiceIndex + 1}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reports */}
      {run.reportIds.length > 0 && (
        <section>
          <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">
            Rapports de combat ({run.reportIds.length})
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {run.reportIds.map((reportId, i) => (
              <Link
                key={reportId}
                to={`/reports/${reportId}`}
                className="inline-flex items-center gap-1 rounded bg-violet-500/10 border border-violet-500/30 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-500/20 transition-colors"
              >
                <FileText className="h-3 w-3" />
                Rapport P{i + 1}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BossCard({ boss }: { boss: RunBoss }) {
  const tierTone =
    boss.tier === 'deep'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      : boss.tier === 'mid'
        ? 'border-violet-500/30 bg-violet-500/10 text-violet-200'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';

  return (
    <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 flex items-start gap-3">
      <div className="shrink-0 h-12 w-12 rounded border border-rose-500/30 bg-rose-950/40 overflow-hidden flex items-center justify-center">
        {boss.image ? (
          <img src={boss.image} alt={boss.name} className="h-full w-full object-cover" />
        ) : (
          <Skull className="h-5 w-5 text-rose-400/70" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-rose-100 truncate">{boss.name}</span>
          <span
            className={cn(
              'inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider',
              tierTone,
            )}
          >
            {boss.tier}
          </span>
        </div>
        {boss.title && (
          <div className="text-[11px] text-rose-300/80 italic truncate">{boss.title}</div>
        )}
        {boss.buffApplied && (
          <div className="mt-1 inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200">
            <Sparkles className="h-2.5 w-2.5" />
            {BUFF_LABELS[boss.buffApplied.type] ?? boss.buffApplied.type}
            <span className="tabular-nums">
              +{Math.round(boss.buffApplied.magnitude * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof TILE_TONE;
}) {
  const t = TILE_TONE[tone];
  return (
    <div className={cn('rounded border p-2', t.border, t.bg)}>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm font-bold tabular-nums mt-0.5', t.text)}>{value}</div>
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────

function Pagination({
  page,
  hasMore,
  total,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  hasMore: boolean;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={page === 0}>
        Précédent
      </Button>
      <div className="text-xs text-muted-foreground tabular-nums">
        {from}–{to} sur {total}
      </div>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!hasMore}>
        Suivant
      </Button>
    </div>
  );
}
