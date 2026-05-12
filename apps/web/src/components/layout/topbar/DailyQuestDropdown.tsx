import { useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExiliumIcon } from '@/components/common/ExiliumIcon';
import { useExilium } from '@/hooks/useExilium';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { trpc } from '@/trpc';

export function DailyQuestDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  const { data: exiliumData } = useExilium();
  const { data: dailyQuests } = trpc.dailyQuest.getQuests.useQuery();
  const hasPending = dailyQuests?.quests.some((q) => q.status === 'pending') ?? false;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground touch-feedback hover:bg-accent"
      >
        <ExiliumIcon size={14} className="text-purple-400" />
        <span className="text-sm font-medium tabular-nums text-purple-400">
          {exiliumData?.balance ?? 0}
        </span>
        {hasPending && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
          </span>
        )}
      </button>

      {open && dailyQuests && <DailyQuestPanel quests={dailyQuests.quests} />}
    </div>
  );
}

function DailyQuestPanel({ quests }: { quests: { id: string; name: string; description: string; status: string }[] }) {
  const now = new Date();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  const msRemaining = Math.max(0, endOfDay.getTime() - now.getTime());
  const hoursRemaining = Math.floor(msRemaining / 3600000);
  const minutesRemaining = Math.floor((msRemaining % 3600000) / 60000);

  return (
    <div className="fixed right-2 left-2 top-12 z-50 mt-1 sm:absolute sm:left-auto sm:top-full sm:right-0 sm:w-72 rounded-md border border-purple-500/30 bg-card/95 backdrop-blur-lg shadow-lg animate-slide-up">
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
        <span className="text-xs font-semibold text-purple-400">Missions journalieres</span>
        <span className="text-[10px] text-muted-foreground">+1 Exilium</span>
      </div>
      <div className="p-3 space-y-2">
        {quests.map((quest) => (
          <div key={quest.id} className="flex items-start gap-2">
            <div className="mt-0.5">
              {quest.status === 'completed' ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : quest.status === 'expired' ? (
                <X className="h-4 w-4 text-muted-foreground-faint" />
              ) : (
                <div className="h-4 w-4 rounded border border-border" />
              )}
            </div>
            <div>
              <span
                className={cn(
                  'text-xs font-medium',
                  quest.status === 'completed'
                    ? 'text-emerald-400'
                    : quest.status === 'expired'
                      ? 'text-muted-foreground-faint line-through'
                      : 'text-foreground',
                )}
              >
                {quest.name}
              </span>
              <p className={cn('text-[10px]', quest.status === 'expired' ? 'text-muted-foreground-faint' : 'text-muted-foreground')}>
                {quest.description}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/30 px-3 py-1.5">
        <span className={cn('text-[10px]', hoursRemaining < 1 ? 'text-destructive' : 'text-muted-foreground')}>
          Expire dans {hoursRemaining}h {minutesRemaining.toString().padStart(2, '0')}m
        </span>
      </div>
    </div>
  );
}
