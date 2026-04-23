import { Link } from 'react-router';
import { trpc } from '@/trpc';
import { ActivityFeedItem } from './ActivityFeedItem';

export function ActivityPreviewCard() {
  const { data: unread } = trpc.alliance.activityUnreadCount.useQuery();
  const unreadCount = unread?.count ?? 0;

  const query = trpc.alliance.activity.useInfiniteQuery(
    { limit: 5 },
    {
      getNextPageParam: () => undefined,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  );

  const items = (query.data?.pages[0]?.items ?? []).slice(0, 5);

  return (
    <section className="glass-card flex flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Activité récente</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
              {unreadCount}
            </span>
          )}
        </div>
        <Link to="/alliance/activite" className="text-xs text-primary hover:underline">
          Voir tout →
        </Link>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore d'activité.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {items.map((log) => (
            <ActivityFeedItem key={log.id} log={log} />
          ))}
        </ul>
      )}
    </section>
  );
}
