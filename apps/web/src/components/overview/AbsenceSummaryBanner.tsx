import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Swords, Hammer, FlaskConical, Rocket, MessageSquare, Sparkles, Coins, Bell, X } from 'lucide-react';
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

/**
 * Résumé d'absence « Bon retour, Commandant » — version BANNIÈRE (P4 refonte IA).
 * Avant : un `<Modal>` monté globalement dans Layout qui BLOQUAIT la page
 * d'atterrissage (vu sur Ressources/Chantier/Empire). Maintenant : une bannière
 * non-bloquante en tête de l'Overview, dismissible, chips cliquables. Ne rend
 * rien hors absence ou une fois fermée (dismiss persisté côté serveur).
 */
export function AbsenceSummaryBanner() {
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
      { key: 'combats', count: data.combats, label: 'Combats', icon: <Swords className="h-3.5 w-3.5" />, accent: 'text-red-300 border-red-500/40 bg-red-950/30', navigateTo: '/fleet/reports' },
      { key: 'builds', count: builds, label: 'Constructions terminées', icon: <Hammer className="h-3.5 w-3.5" />, accent: 'text-orange-300 border-orange-500/40 bg-orange-950/30', navigateTo: '/' },
      { key: 'research', count: research, label: 'Recherches terminées', icon: <FlaskConical className="h-3.5 w-3.5" />, accent: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/30', navigateTo: '/research' },
      { key: 'fleets', count: fleets, label: 'Mouvements de flotte', icon: <Rocket className="h-3.5 w-3.5" />, accent: 'text-blue-300 border-blue-500/40 bg-blue-950/30', navigateTo: '/fleet' },
      { key: 'pve', count: pve, label: 'Missions PvE', icon: <Sparkles className="h-3.5 w-3.5" />, accent: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30', navigateTo: '/missions' },
      { key: 'market', count: market, label: 'Ventes au marché', icon: <Coins className="h-3.5 w-3.5" />, accent: 'text-amber-300 border-amber-500/40 bg-amber-950/30', navigateTo: '/market' },
      { key: 'messages', count: data.messages, label: 'Messages non lus', icon: <MessageSquare className="h-3.5 w-3.5" />, accent: 'text-violet-300 border-violet-500/40 bg-violet-950/30', navigateTo: '/messages' },
      { key: 'friend', count: friendRequests, label: "Demandes d'amis", icon: <Bell className="h-3.5 w-3.5" />, accent: 'text-pink-300 border-pink-500/40 bg-pink-950/30' },
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
    <div className="relative rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fermer le résumé d'absence"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-2 flex items-center gap-1.5 pr-8 text-xs font-semibold uppercase tracking-wider text-primary/70">
        <Sparkles className="h-3 w-3" />
        Bon retour, Commandant
        {sections.length > 0 && (
          <span className="font-normal normal-case tracking-normal text-muted-foreground">· absent {formatDuration(data.durationMs)}</span>
        )}
      </div>
      {sections.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sections.map((section) => {
            const clickable = !!section.navigateTo;
            return (
              <button
                key={section.key}
                type="button"
                onClick={clickable ? () => handleNavigate(section.navigateTo!) : undefined}
                disabled={!clickable}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                  section.accent,
                  clickable ? 'hover:brightness-125 cursor-pointer' : 'cursor-default',
                )}
              >
                <span className="shrink-0">{section.icon}</span>
                <span className="font-medium">{section.label}</span>
                <span className="font-display font-semibold tabular-nums">{section.count > 999 ? '999+' : section.count}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Rien de neuf pendant ton absence de {formatDuration(data.durationMs)}.</p>
      )}
    </div>
  );
}
