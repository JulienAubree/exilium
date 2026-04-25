import { useParams, Link } from 'react-router';
import { useState } from 'react';
import { ArrowLeft, Ship, Gem, Sparkles } from 'lucide-react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PlanetCard } from './player-detail/PlanetCard';
import { ResearchSection } from './player-detail/ResearchSection';
import { FlagshipSection } from './player-detail/FlagshipSection';
import { ExiliumSection } from './player-detail/ExiliumSection';
import { TalentsSection } from './player-detail/TalentsSection';

export default function PlayerDetail() {
  const { id } = useParams();
  const { data, isLoading, refetch } = trpc.playerAdmin.detail.useQuery(
    { userId: id! },
    { enabled: !!id },
  );
  const { data: gameConfig } = useGameConfig();
  const [capitalConfirm, setCapitalConfirm] = useState<{ planetId: string; name: string } | null>(null);
  const setCapitalMut = trpc.playerAdmin.setCapital.useMutation({
    onSuccess: () => { refetch(); setCapitalConfirm(null); },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return <div className="text-gray-500">Joueur introuvable.</div>;

  return (
    <div className="animate-fade-in">
      <Link to="/players" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 mb-4">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
        <h1 className="text-lg font-semibold text-gray-100">{data.user.username}</h1>
        <span className="text-sm text-gray-500 break-all">{data.user.email}</span>
        {data.user.bannedAt && <span className="admin-badge-danger">Banni</span>}
      </div>

      {/* Planets */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
        Planetes ({data.planets?.length ?? 0})
      </h2>

      <div className="space-y-4 mb-8">
        {data.planets?.map((planet: any) => (
          <PlanetCard
            key={planet.id}
            planet={planet}
            buildingDefs={gameConfig?.buildings ?? {}}
            onSetCapital={setCapitalConfirm}
            onSaved={refetch}
          />
        ))}
      </div>

      {/* Research */}
      {data.research && (
        <>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Recherches</h2>
          <ResearchSection research={data.research as Record<string, unknown>} />
        </>
      )}

      {/* Flagship */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Ship className="w-4 h-4" /> Vaisseau Amiral
      </h2>
      {data.flagship ? (
        <FlagshipSection flagship={data.flagship} userId={data.user.id} onSaved={refetch} />
      ) : (
        <div className="admin-card p-4 mb-8 text-sm text-gray-500">Aucun vaisseau amiral.</div>
      )}

      {/* Exilium */}
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Gem className="w-4 h-4" /> Exilium
      </h2>
      <ExiliumSection exilium={data.exilium} userId={data.user.id} onSaved={refetch} />

      {/* Talents */}
      {data.flagship && (
        <>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Talents Flagship
          </h2>
          <TalentsSection
            talents={data.flagshipTalents ?? []}
            flagshipId={data.flagship.id}
            gameConfig={gameConfig}
            onSaved={refetch}
          />
        </>
      )}

      <ConfirmDialog
        open={!!capitalConfirm}
        title="Changer la capitale ?"
        message={`"${capitalConfirm?.name}" deviendra la capitale. L'IPC sera supprime de l'ancienne capitale.`}
        confirmLabel={setCapitalMut.isPending ? '...' : 'Confirmer'}
        onConfirm={() => {
          if (capitalConfirm && id) {
            setCapitalMut.mutate({ userId: id, planetId: capitalConfirm.planetId });
          }
        }}
        onCancel={() => setCapitalConfirm(null)}
      />
    </div>
  );
}
