import { useParams, Link } from 'react-router';
import { trpc } from '@/trpc';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

function ResourceEditor({
  planetId,
  metal,
  crystal,
  deuterium,
  onSaved,
}: {
  planetId: string;
  metal: string;
  crystal: string;
  deuterium: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ metal, crystal, deuterium });
  const mutation = trpc.playerAdmin.updateResources.useMutation({ onSuccess: onSaved });

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={form.metal}
        onChange={(e) => setForm({ ...form, metal: e.target.value })}
        className="admin-input w-28 py-1 text-xs"
        title="Metal"
      />
      <input
        type="text"
        value={form.crystal}
        onChange={(e) => setForm({ ...form, crystal: e.target.value })}
        className="admin-input w-28 py-1 text-xs"
        title="Cristal"
      />
      <input
        type="text"
        value={form.deuterium}
        onChange={(e) => setForm({ ...form, deuterium: e.target.value })}
        className="admin-input w-28 py-1 text-xs"
        title="Deuterium"
      />
      <button
        onClick={() => mutation.mutate({ planetId, ...form })}
        disabled={mutation.isPending}
        className="admin-btn-primary py-1 px-3 text-xs"
      >
        {mutation.isPending ? '...' : 'Sauver'}
      </button>
    </div>
  );
}

export default function PlayerDetail() {
  const { id } = useParams();
  const { data, isLoading, refetch } = trpc.playerAdmin.detail.useQuery(
    { userId: id! },
    { enabled: !!id },
  );

  if (isLoading) return <PageSkeleton />;
  if (!data) return <div className="text-gray-500">Joueur introuvable.</div>;

  return (
    <div className="animate-fade-in">
      <Link to="/players" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-4">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-lg font-semibold text-gray-100">{data.user.username}</h1>
        <span className="text-sm text-gray-500">{data.user.email}</span>
        {data.user.bannedAt && <span className="admin-badge-danger">Banni</span>}
      </div>

      {/* Planets */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Planetes ({data.planets?.length ?? 0})
      </h2>

      <div className="space-y-4 mb-8">
        {data.planets?.map((planet: any) => (
          <div key={planet.id} className="admin-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-medium text-gray-200">{planet.name}</span>
                <span className="ml-2 font-mono text-xs text-gray-500">
                  [{planet.galaxy}:{planet.system}:{planet.position}]
                </span>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1">Ressources (Metal / Cristal / Deut)</div>
              <ResourceEditor
                planetId={planet.id}
                metal={String(Math.floor(Number(planet.metal ?? 0)))}
                crystal={String(Math.floor(Number(planet.crystal ?? 0)))}
                deuterium={String(Math.floor(Number(planet.deuterium ?? 0)))}
                onSaved={refetch}
              />
            </div>

            {/* Building levels */}
            <div className="text-xs text-gray-500 mb-1">Batiments</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {Object.entries(planet)
                .filter(([key]) => key.endsWith('Level'))
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between bg-panel rounded px-2 py-1">
                    <span className="text-xs text-gray-400 truncate">{key.replace('Level', '')}</span>
                    <span className="font-mono text-xs text-gray-200 ml-1">{String(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Research */}
      {data.research && (
        <>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Recherches</h2>
          <div className="admin-card p-4 mb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Object.entries(data.research)
                .filter(([key]) => key !== 'id' && key !== 'userId')
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between bg-panel rounded px-2 py-1">
                    <span className="text-xs text-gray-400">{key}</span>
                    <span className="font-mono text-xs text-gray-200">{String(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
