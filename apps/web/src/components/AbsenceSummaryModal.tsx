import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Swords, Hammer, FlaskConical, Rocket, MessageSquare, Sparkles, Coins, Bell, X } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h${String(remaining).padStart(2, '0')}` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingH = hours % 24;
  return remainingH > 0 ? `${days}j ${remainingH}h` : `${days}j`;
}

interface Section {
  key: string;
  count: number;
  label: string;
  icon: React.ReactNode;
  accent: string;
  navigateTo?: string;
}

export function AbsenceSummaryModal() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = trpc.user.getAbsenceSummary.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000,
  });

  const dismissMutation = trpc.user.dismissAbsenceSummary.useMutation({
    onSettled: () => {
      utils.user.getAbsenceSummary.invalidate();
    },
  });

  const sections = useMemo<Section[]>(() => {
    if (!data || !data.hasAbsence) return [];
    const g = data.groups;
    const builds = (g['building-done'] ?? 0) + (g['shipyard-done'] ?? 0);
    const research = g['research-done'] ?? 0;
    const fleets = (g['fleet-arrived'] ?? 0) + (g['fleet-returned'] ?? 0);
    const pve = g['pve-mission-done'] ?? 0;
    const market = g['market-offer-sold'] ?? 0;
    const friendRequests = g['friend-request'] ?? 0;

    return ([
      { key: 'combats', count: data.combats, label: 'Combats', icon: <Swords className="h-4 w-4" />, accent: 'text-red-300 border-red-500/40 bg-red-950/30', navigateTo: '/reports' },
      { key: 'builds', count: builds, label: 'Constructions et vaisseaux terminés', icon: <Hammer className="h-4 w-4" />, accent: 'text-orange-300 border-orange-500/40 bg-orange-950/30', navigateTo: '/' },
      { key: 'research', count: research, label: 'Recherches terminées', icon: <FlaskConical className="h-4 w-4" />, accent: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/30', navigateTo: '/research' },
      { key: 'fleets', count: fleets, label: 'Mouvements de flotte', icon: <Rocket className="h-4 w-4" />, accent: 'text-blue-300 border-blue-500/40 bg-blue-950/30', navigateTo: '/fleet' },
      { key: 'pve', count: pve, label: 'Missions PvE accomplies', icon: <Sparkles className="h-4 w-4" />, accent: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30', navigateTo: '/missions' },
      { key: 'market', count: market, label: 'Ventes au marché', icon: <Coins className="h-4 w-4" />, accent: 'text-amber-300 border-amber-500/40 bg-amber-950/30', navigateTo: '/market' },
      { key: 'messages', count: data.messages, label: 'Messages non lus', icon: <MessageSquare className="h-4 w-4" />, accent: 'text-violet-300 border-violet-500/40 bg-violet-950/30', navigateTo: '/messages' },
      { key: 'friend', count: friendRequests, label: 'Demandes d\'amis', icon: <Bell className="h-4 w-4" />, accent: 'text-pink-300 border-pink-500/40 bg-pink-950/30' },
    ] satisfies Section[]).filter((s) => s.count > 0);
  }, [data]);

  if (isLoading || !data || !data.hasAbsence || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    dismissMutation.mutate();
  };

  const handleNavigate = (to: string) => {
    handleDismiss();
    navigate(to);
  };

  return (
    <Modal
      open
      onClose={handleDismiss}
      title="Bon retour, Commandant"
      className="lg:max-w-xl"
    >
      <p className="text-sm text-muted-foreground mb-4">
        Pendant ton absence de{' '}
        <span className="font-semibold text-foreground">{formatDuration(data.durationMs)}</span>,
        voici ce qui s'est passé sur ton empire :
      </p>

      <ul className="space-y-2 max-h-[55vh] overflow-y-auto">
        {sections.map((section) => {
          const clickable = !!section.navigateTo;
          const handleClick = clickable ? () => handleNavigate(section.navigateTo!) : undefined;
          return (
            <li key={section.key}>
              <button
                type="button"
                onClick={handleClick}
                disabled={!clickable}
                className={cn(
                  'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  section.accent,
                  clickable ? 'hover:brightness-125 cursor-pointer' : 'cursor-default',
                )}
              >
                <span className="shrink-0">{section.icon}</span>
                <span className="flex-1 text-sm font-medium">{section.label}</span>
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {section.count > 999 ? '999+' : section.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm text-foreground/80 hover:bg-card/80 hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Fermer
        </button>
      </div>
    </Modal>
  );
}
