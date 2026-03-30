import { trpc } from '@/trpc';
import { useCallback, useRef } from 'react';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_LABELS } from '@exilium/shared';
import type { NotificationCategory } from '@exilium/shared';

const CHANNELS = ['toastDisabled', 'pushDisabled', 'bellDisabled'] as const;
const CHANNEL_LABELS = { toastDisabled: 'Toast', pushDisabled: 'Push', bellDisabled: 'Cloche' };
const CHANNEL_ICONS = {
  toastDisabled: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/></svg>
  ),
  pushDisabled: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
  ),
  bellDisabled: (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
  ),
};

export function NotificationPreferences() {
  const { data: prefs, isLoading } = trpc.notificationPreferences.getPreferences.useQuery();
  const utils = trpc.useUtils();
  const mutation = trpc.notificationPreferences.updatePreferences.useMutation({
    onSuccess: (data) => {
      utils.notificationPreferences.getPreferences.setData(undefined, data);
    },
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingRef = useRef<typeof prefs>(undefined);

  const scheduleUpdate = useCallback((next: NonNullable<typeof prefs>) => {
    pendingRef.current = next;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (pendingRef.current) {
        mutation.mutate(pendingRef.current);
      }
    }, 500);
  }, [mutation]);

  function toggle(channel: typeof CHANNELS[number], category: NotificationCategory) {
    if (!prefs) return;
    const current = prefs[channel];
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    const updated = { ...prefs, [channel]: next };
    utils.notificationPreferences.getPreferences.setData(undefined, updated);
    scheduleUpdate(updated);
  }

  if (isLoading || !prefs) {
    return <div className="text-sm text-muted-foreground p-4">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Choisissez quels événements déclenchent chaque type de notification.
      </p>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_repeat(3,56px)] gap-1 items-center text-center">
        <div />
        {CHANNELS.map((ch) => (
          <div key={ch} className="flex flex-col items-center gap-0.5">
            {CHANNEL_ICONS[ch]}
            <span className="text-[10px] text-muted-foreground">{CHANNEL_LABELS[ch]}</span>
          </div>
        ))}
      </div>

      {/* Category rows */}
      {NOTIFICATION_CATEGORIES.map((cat) => (
        <div
          key={cat}
          className="grid grid-cols-[1fr_repeat(3,56px)] gap-1 items-center rounded-lg border border-border/50 px-3 py-2"
        >
          <span className="text-sm">{NOTIFICATION_CATEGORY_LABELS[cat]}</span>
          {CHANNELS.map((ch) => {
            const disabled = prefs[ch].includes(cat);
            return (
              <div key={ch} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => toggle(ch, cat)}
                  className={`h-5 w-9 rounded-full transition-colors ${disabled ? 'bg-muted' : 'bg-emerald-500'}`}
                >
                  <div
                    className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${disabled ? 'translate-x-0.5' : 'translate-x-[18px]'}`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
