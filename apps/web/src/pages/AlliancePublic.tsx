import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { trpc } from '@/trpc';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { AllianceBlason } from '@/components/alliance/AllianceBlason';
import { useToastStore } from '@/stores/toast.store';
import type { Blason } from '@exilium/shared';

function formatFounded(createdAt: string): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(createdAt));
}

const ROLE_LABEL: Record<string, string> = {
  founder: 'Fondateur',
  officer: 'Officier',
  member: 'Membre',
};

export default function AlliancePublic() {
  const { allianceId } = useParams<{ allianceId: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const { data: alliance, isLoading, isError } = trpc.alliance.get.useQuery(
    { allianceId: allianceId! },
    { enabled: !!allianceId, retry: false },
  );
  const { data: myAlliance } = trpc.alliance.myAlliance.useQuery();
  const utils = trpc.useUtils();

  // If the viewer is a member of the alliance they're looking at, send them
  // straight to the private hub — they have richer info there.
  useEffect(() => {
    if (alliance && myAlliance && alliance.id === myAlliance.id) {
      navigate('/alliance', { replace: true });
    }
  }, [alliance, myAlliance, navigate]);

  const applyMutation = trpc.alliance.submitApplication.useMutation({
    onSuccess: () => {
      addToast('Candidature envoyée', 'success');
      utils.alliance.get.invalidate({ allianceId: allianceId! });
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  if (!allianceId) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState title="Alliance introuvable" description="Identifiant d'alliance manquant." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <CardGridSkeleton count={2} />
      </div>
    );
  }

  if (isError || !alliance) {
    return (
      <div className="p-4 lg:p-6">
        <EmptyState
          title="Alliance introuvable"
          description="Cette alliance n'existe plus ou a été dissoute."
          action={{ label: 'Voir le classement', onClick: () => navigate('/alliance-ranking') }}
        />
      </div>
    );
  }

  const blason: Blason = {
    shape: alliance.blasonShape as Blason['shape'],
    icon: alliance.blasonIcon as Blason['icon'],
    color1: alliance.blasonColor1,
    color2: alliance.blasonColor2,
  };

  const { wins, losses, windowDays } = alliance.recentMilitary;
  const militaryTone = wins === 0 && losses === 0 ? 'neutral' : wins >= losses ? 'positive' : 'negative';
  const canApply = !myAlliance;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="h-full w-full opacity-40 blur-2xl"
            style={{
              background: `radial-gradient(circle at 25% 40%, ${blason.color1}, transparent 55%), radial-gradient(circle at 75% 60%, ${blason.color2}, transparent 60%)`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        </div>

        <div className="relative px-5 pb-6 pt-8 lg:px-8 lg:pb-8 lg:pt-10">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/30 bg-background/40 p-2 shadow-lg shadow-primary/10 backdrop-blur lg:h-24 lg:w-24">
                <AllianceBlason blason={blason} size={72} title={`Blason de ${alliance.name}`} />
              </div>
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <h1 className="truncate text-xl font-bold text-foreground lg:text-2xl">
                {alliance.name}
                <span className="ml-2 font-normal text-muted-foreground">[{alliance.tag}]</span>
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Alliance · Rang #{alliance.rank}</p>
              {alliance.motto && (
                <p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">« {alliance.motto} »</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-300">
                  {alliance.memberCount} membre{alliance.memberCount > 1 ? 's' : ''}
                </span>
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
                  {alliance.totalPoints.toLocaleString('fr-FR')} pts
                </span>
                <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-300">
                  Fondée en {formatFounded(alliance.createdAt)}
                </span>
                {militaryTone === 'positive' && (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                    {windowDays}j · {wins}V / {losses}D
                  </span>
                )}
                {militaryTone === 'negative' && (
                  <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300">
                    {windowDays}j · {wins}V / {losses}D
                  </span>
                )}
                {militaryTone === 'neutral' && (
                  <span className="inline-flex items-center rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {windowDays}j · aucun combat
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 lg:px-6 lg:pb-6">
        <div className="mx-auto w-full max-w-[720px] space-y-4">
          {/* Description */}
          {alliance.description && (
            <section className="glass-card p-4">
              <h2 className="mb-2 text-base font-semibold">À propos</h2>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{alliance.description}</p>
            </section>
          )}

          {/* Members list */}
          <section className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Membres ({alliance.members.length})</h2>
              {alliance.founderUsername && (
                <span className="text-xs text-muted-foreground">
                  Fondé par{' '}
                  <Link
                    to={`/player/${alliance.members.find((m) => m.role === 'founder')?.userId ?? ''}`}
                    className="text-foreground hover:text-primary hover:underline"
                  >
                    {alliance.founderUsername}
                  </Link>
                </span>
              )}
            </div>

            <ul className="space-y-1">
              {alliance.members.map((m) => (
                <li key={m.userId}>
                  <Link
                    to={`/player/${m.userId}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50"
                  >
                    <span className="font-medium text-foreground">{m.username}</span>
                    <span
                      className={`text-xs ${
                        m.role === 'founder'
                          ? 'text-amber-300'
                          : m.role === 'officer'
                            ? 'text-sky-300'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Apply CTA — only when the viewer has no alliance */}
          {canApply && (
            <section className="glass-card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Vous n'êtes membre d'aucune alliance</p>
                <p className="text-xs text-muted-foreground">
                  Postulez pour rejoindre <span className="text-foreground">{alliance.name}</span>.
                </p>
              </div>
              <Button
                size="sm"
                disabled={applyMutation.isPending}
                onClick={() => applyMutation.mutate({ allianceId: alliance.id })}
              >
                {applyMutation.isPending ? 'Envoi...' : 'Postuler'}
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
