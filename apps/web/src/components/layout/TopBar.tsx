import { useState } from 'react';
import { Mail } from 'lucide-react';
import { FlagshipNamingModal } from '@/components/flagship/FlagshipNamingModal';
import { useNavigate, Link } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { usePlanetStore } from '@/stores/planet.store';
import { cn } from '@/lib/utils';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';
import { ReportsIcon } from '@/lib/icons';
import { useGameConfig } from '@/hooks/useGameConfig';
import { PlanetSelectorDropdown } from './topbar/PlanetSelectorDropdown';
import { DailyQuestDropdown } from './topbar/DailyQuestDropdown';
import { OnboardingButton } from './topbar/OnboardingButton';
import { NotificationsBell } from './topbar/NotificationsBell';
import { ProfileMenu } from './topbar/ProfileMenu';

interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  planetClassId: string | null;
  planetImageIndex: number | null;
  status?: string;
}

function ResourceBadge({ label, value, glowClass, colorClass, icon, capacity }: {
  label: string;
  value: number;
  glowClass: string;
  colorClass: string;
  icon?: React.ReactNode;
  capacity?: number;
}) {
  const overCap = capacity != null && value > capacity;
  return (
    <div className="flex items-center gap-2">
      {icon && <span className={colorClass}>{icon}</span>}
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          overCap ? 'text-amber-400' : colorClass,
          overCap ? '' : glowClass,
        )}
        title={overCap ? 'Stock au-delà de la capacité (production à l’arrêt)' : undefined}
      >
        {value.toLocaleString('fr-FR')}
      </span>
    </div>
  );
}

export function TopBar({ planetId, planets }: { planetId: string | null; planets: Planet[] }) {
  useGameConfig();
  const navigate = useNavigate();
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const [showNamingModal, setShowNamingModal] = useState(false);

  const { data: tutorialData } = trpc.tutorial.getCurrent.useQuery();
  const tutorialComplete = tutorialData?.isComplete ?? true;
  const { data: unreadCount } = trpc.message.unreadCount.useQuery();
  const { data: reportUnreadCount } = trpc.report.unreadCount.useQuery();

  // SSE invalidates resource.production on building-done / fleet-arrived /
  // fleet-returned / market-offer-sold. Kept a long poll as safety net in
  // case SSE disconnects silently — 5 min keeps the UI eventually-correct
  // without flooding the API.
  const { data } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId, refetchInterval: 300_000 },
  );

  const resources = useResourceCounter(
    data
      ? {
          minerai: data.minerai,
          silicium: data.silicium,
          hydrogene: data.hydrogene,
          resourcesUpdatedAt: data.resourcesUpdatedAt,
          mineraiPerHour: data.rates.mineraiPerHour,
          siliciumPerHour: data.rates.siliciumPerHour,
          hydrogenePerHour: data.rates.hydrogenePerHour,
          storageMineraiCapacity: data.rates.storageMineraiCapacity,
          storageSiliciumCapacity: data.rates.storageSiliciumCapacity,
          storageHydrogeneCapacity: data.rates.storageHydrogeneCapacity,
        }
      : undefined,
  );

  const energyBalance = data ? data.rates.energyProduced - data.rates.energyConsumed : 0;

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-12 lg:min-h-14 items-center justify-between border-b border-white/10 bg-card/80 backdrop-blur-md px-4 pt-[env(safe-area-inset-top)] lg:px-6">
        <div className="flex items-center gap-4 lg:gap-6">
          <PlanetSelectorDropdown
            planetId={planetId}
            planets={planets}
            onSelect={setActivePlanet}
          />

          {/* Resources — desktop only */}
          <div className="hidden lg:flex items-center gap-4">
            <ResourceBadge label="Minerai" value={resources.minerai} glowClass="glow-minerai" colorClass="text-minerai" icon={<MineraiIcon size={14} />} capacity={data?.rates.storageMineraiCapacity} />
            <ResourceBadge label="Silicium" value={resources.silicium} glowClass="glow-silicium" colorClass="text-silicium" icon={<SiliciumIcon size={14} />} capacity={data?.rates.storageSiliciumCapacity} />
            <ResourceBadge label="Hydrogène" value={resources.hydrogene} glowClass="glow-hydrogene" colorClass="text-hydrogene" icon={<HydrogeneIcon size={14} />} capacity={data?.rates.storageHydrogeneCapacity} />
            <ResourceBadge
              label="Énergie"
              value={energyBalance}
              glowClass={energyBalance >= 0 ? 'glow-energy' : ''}
              colorClass={energyBalance >= 0 ? 'text-energy' : 'text-destructive'}
              icon={<EnergieIcon size={14} />}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 lg:gap-2">
          {tutorialComplete ? (
            <DailyQuestDropdown />
          ) : (
            <OnboardingButton showNamingModal={() => setShowNamingModal(true)} />
          )}

          {/* Messages (envelope) */}
          <button
            onClick={() => navigate('/messages')}
            className="relative rounded-lg p-2 lg:p-2.5 text-muted-foreground touch-feedback hover:bg-accent hover:text-foreground"
            title="Messages"
          >
            <Mail className="h-5 w-5" />
            {(unreadCount ?? 0) > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </button>

          <NotificationsBell />

          <Link
            to="/reports"
            className="relative rounded-lg p-2 lg:p-2.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Rapports"
          >
            <ReportsIcon width={18} height={18} />
            {(reportUnreadCount?.count ?? 0) > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {reportUnreadCount!.count}
              </span>
            )}
          </Link>

          <ProfileMenu />
        </div>
      </header>

      <FlagshipNamingModal open={showNamingModal} onClose={() => setShowNamingModal(false)} />
    </>
  );
}
