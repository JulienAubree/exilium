import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Users, Globe, Rocket, Activity, AlertTriangle, Clock } from 'lucide-react';

const REFRESH_MS = 15_000;

export default function Dashboard() {
  const { data, isLoading } = trpc.dashboard.stats.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });
  const { data: errors } = trpc.dashboard.recentErrors.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  if (isLoading || !data) return <PageSkeleton />;

  const updatedAt = new Date(data.timestamp);
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-100">Dashboard</h1>
        <span className="text-xs text-gray-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          MAJ {updatedAt.toLocaleTimeString('fr-FR')} · rafraîchi toutes les {REFRESH_MS / 1000}s
        </span>
      </div>

      <section className="mb-6">
        <h2 className="text-xs font-mono font-medium text-gray-500 uppercase tracking-widest mb-3">Joueurs</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Total" value={data.users.total} />
          <StatCard icon={Activity} label="Actifs 1h" value={data.users.active1h} accent="text-emerald-400" />
          <StatCard icon={Activity} label="Actifs 24h" value={data.users.active24h} />
          <StatCard icon={Activity} label="Actifs 7j" value={data.users.active7d} />
          <StatCard icon={AlertTriangle} label="Bannis" value={data.users.banned} accent={data.users.banned > 0 ? 'text-red-400' : undefined} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-mono font-medium text-gray-500 uppercase tracking-widest mb-3">Monde</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Globe} label="Planètes" value={data.world.planets} />
          <StatCard icon={Users} label="Alliances" value={data.world.alliances} />
          <StatCard icon={Rocket} label="Flottes actives" value={data.world.activeFleets} />
          <StatCard icon={Activity} label="Builds en cours" value={data.world.activeBuilds} />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-mono font-medium text-gray-500 uppercase tracking-widest mb-3">Activité 24h</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Flottes envoyées" value={data.activity24h.fleetsSent} />
          <StatCard label="Constructions terminées" value={data.activity24h.buildsCompleted} />
          <StatCard label="Logins OK" value={data.activity24h.loginsSuccess} accent="text-emerald-400" />
          <StatCard
            label="Logins échoués"
            value={data.activity24h.loginsFailed}
            accent={data.activity24h.loginsFailed > 20 ? 'text-red-400' : 'text-gray-300'}
          />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-mono font-medium text-gray-500 uppercase tracking-widest mb-3">Queues BullMQ</h2>
        <div className="rounded-md border border-panel-border bg-panel-bg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-hover text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Queue</th>
                <th className="text-right px-3 py-2">Active</th>
                <th className="text-right px-3 py-2">Waiting</th>
                <th className="text-right px-3 py-2">Delayed</th>
                <th className="text-right px-3 py-2">Failed</th>
                <th className="text-right px-3 py-2">Completed</th>
              </tr>
            </thead>
            <tbody>
              {data.queues.map((q) => (
                <tr key={q.name} className="border-t border-panel-border">
                  <td className="px-3 py-2 font-mono text-gray-300">{q.name}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{q.active}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{q.waiting}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{q.delayed}</td>
                  <td className={`text-right px-3 py-2 tabular-nums ${q.failed > 0 ? 'text-red-400 font-semibold' : ''}`}>{q.failed}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-gray-500">{q.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-mono font-medium text-gray-500 uppercase tracking-widest mb-3">Logins échoués récents</h2>
        {errors && errors.length > 0 ? (
          <div className="rounded-md border border-panel-border bg-panel-bg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel-hover text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Raison</th>
                  <th className="text-left px-3 py-2">IP</th>
                  <th className="text-right px-3 py-2">Quand</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={i} className="border-t border-panel-border">
                    <td className="px-3 py-2 truncate max-w-[220px]">{e.email}</td>
                    <td className="px-3 py-2 text-gray-400">{e.reason ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-500 text-xs">{e.ipAddress ?? '—'}</td>
                    <td className="text-right px-3 py-2 text-gray-500 text-xs">
                      {new Date(e.createdAt).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic">Aucun login échoué dans les 24 dernières heures.</div>
        )}
      </section>
    </div>
  );
}

type IconCmp = React.ComponentType<{ className?: string }>;

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon?: IconCmp;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-panel-border bg-panel-bg px-3 py-2.5">
      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
        {Icon ? <Icon className="w-3 h-3" /> : null}
        {label}
      </div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${accent ?? 'text-gray-100'}`}>{value.toLocaleString('fr-FR')}</div>
    </div>
  );
}
