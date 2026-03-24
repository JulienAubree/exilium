import { useParams } from 'react-router';
import { trpc } from '@/trpc';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/common/Skeleton';
import { useChatStore } from '@/stores/chat.store';

const PLAYSTYLE_LABELS: Record<string, string> = {
  miner: 'Mineur',
  warrior: 'Guerrier',
  explorer: 'Explorateur',
};

function PlayerProfileSkeleton() {
  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
        <div className="space-y-4">
          <div className="glass-card p-4 flex flex-col items-center gap-3">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="glass-card p-4 space-y-3">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="glass-card p-4 space-y-3">
            <Skeleton className="h-5 w-28" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Joueur introuvable" />
      <div className="glass-card p-8 text-center">
        <p className="text-muted-foreground">Ce profil n'existe pas ou a été supprimé.</p>
      </div>
    </div>
  );
}

export default function PlayerProfile() {
  const { userId } = useParams<{ userId: string }>();
  const utils = trpc.useUtils();
  const openChat = useChatStore((s) => s.openChat);

  const { data: player, isLoading, isError } = trpc.user.getProfile.useQuery(
    { userId: userId! },
    { enabled: !!userId },
  );

  const requestMutation = trpc.friend.request.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate({ userId: userId! }),
  });
  const cancelMutation = trpc.friend.cancel.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate({ userId: userId! }),
  });
  const acceptMutation = trpc.friend.accept.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate({ userId: userId! }),
  });
  const declineMutation = trpc.friend.decline.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate({ userId: userId! }),
  });
  const removeMutation = trpc.friend.remove.useMutation({
    onSuccess: () => utils.user.getProfile.invalidate({ userId: userId! }),
  });

  if (isLoading) return <PlayerProfileSkeleton />;
  if (isError || !player) return <NotFound />;

  const isMutating =
    requestMutation.isPending ||
    cancelMutation.isPending ||
    acceptMutation.isPending ||
    declineMutation.isPending ||
    removeMutation.isPending;

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title={`Profil de ${player.username}`} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
        {/* ===== Left column ===== */}
        <div className="space-y-4">
          {/* Avatar + Identity */}
          <div className="glass-card p-4 flex flex-col items-center gap-3">
            {player.avatarId ? (
              <img
                src={`/assets/avatars/${player.avatarId}.webp`}
                alt={player.username}
                className="h-24 w-24 rounded-full object-cover border-2 border-white/10"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                {player.username.slice(0, 2).toUpperCase()}
              </div>
            )}

            <h2 className="text-lg font-bold">{player.username}</h2>

            {player.stats && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                #{player.stats.rank}
              </span>
            )}

            {player.playstyle && (
              <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                {PLAYSTYLE_LABELS[player.playstyle] ?? player.playstyle}
              </span>
            )}

            {player.seekingAlliance && (
              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
                Cherche une alliance
              </span>
            )}
          </div>
        </div>

        {/* ===== Right column ===== */}
        <div className="space-y-4">
          {/* Bio */}
          {player.bio != null && (
            <div className="glass-card p-4 space-y-2">
              <h3 className="text-sm font-semibold">Bio</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{player.bio || 'Aucune bio renseignée.'}</p>
            </div>
          )}

          {/* Stats grid */}
          {player.stats != null && (
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">Statistiques</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-accent/50 p-3 text-center">
                  <div className="text-lg font-bold text-primary">#{player.stats.rank}</div>
                  <div className="text-xs text-muted-foreground">Rang</div>
                </div>
                <div className="rounded-lg bg-accent/50 p-3 text-center">
                  <div className="text-lg font-bold text-primary">{player.stats.totalPoints.toLocaleString('fr-FR')}</div>
                  <div className="text-xs text-muted-foreground">Points</div>
                </div>
                <div className="rounded-lg bg-accent/50 p-3 text-center">
                  <div className="text-lg font-bold text-primary">{player.stats.planetCount}</div>
                  <div className="text-xs text-muted-foreground">Planètes</div>
                </div>
                <div className="rounded-lg bg-accent/50 p-3 text-center">
                  <div className="text-lg font-bold text-primary">{player.stats.allianceName ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">Alliance</div>
                </div>
              </div>
            </div>
          )}

          {/* Friend action + Message */}
          <div className="glass-card p-4 flex flex-wrap items-center gap-3">
            {/* Friend action button(s) */}
            {player.friendshipStatus === 'none' && (
              <button
                onClick={() => requestMutation.mutate({ userId: player.id })}
                disabled={isMutating}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Ajouter en ami
              </button>
            )}

            {player.friendshipStatus === 'pending_sent' && (
              <button
                onClick={() => cancelMutation.mutate({ friendshipId: player.friendshipId! })}
                disabled={isMutating}
                className="rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                Annuler la demande
              </button>
            )}

            {player.friendshipStatus === 'pending_received' && (
              <>
                <button
                  onClick={() => acceptMutation.mutate({ friendshipId: player.friendshipId! })}
                  disabled={isMutating}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Accepter
                </button>
                <button
                  onClick={() => declineMutation.mutate({ friendshipId: player.friendshipId! })}
                  disabled={isMutating}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  Refuser
                </button>
              </>
            )}

            {player.friendshipStatus === 'friends' && (
              <button
                onClick={() => removeMutation.mutate({ friendshipId: player.friendshipId! })}
                disabled={isMutating}
                className="rounded-md bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
              >
                Retirer des amis
              </button>
            )}

            {/* Message button */}
            <button
              onClick={() => openChat(player.id, player.username)}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Envoyer un message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
