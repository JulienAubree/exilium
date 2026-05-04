import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Zap } from 'lucide-react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';
import { OverviewIcon } from '@/lib/icons';
import { SectionHeader } from '@/components/entity-details/stat-components';
import { ActiveAbilityCard, type AbilityLite, type ScanCoords } from './ActiveAbilityCard';
import { getHullCardStyles } from './hullCardStyles';

interface HullConfigLite {
  id: string;
  name: string;
  description: string;
  abilities?: AbilityLite[];
  bonusLabels?: string[];
}

interface FlagshipLite {
  status: string;
}

interface HullAbilitiesPanelProps {
  flagship: FlagshipLite;
  hullConfig: HullConfigLite;
  hullId: string;
}

export function HullAbilitiesPanel({ flagship, hullConfig, hullId }: HullAbilitiesPanelProps) {
  const [scanTarget, setScanTarget] = useState<ScanCoords>({ galaxy: 0, system: 0, position: 0 });
  const [scanError, setScanError] = useState('');

  const utils = trpc.useUtils();
  const { data: flagshipData } = trpc.flagship.get.useQuery();

  const navigate = useNavigate();
  const scanMutation = trpc.flagship.scan.useMutation({
    onSuccess: (data) => {
      setScanTarget({ galaxy: 0, system: 0, position: 0 });
      setScanError('');
      utils.flagship.get.invalidate();
      if (data.reportId) {
        navigate(`/reports/${data.reportId}`);
      }
    },
    onError: (err) => setScanError(err.message),
  });

  const handleScan = () => {
    if (!scanTarget.galaxy || !scanTarget.system || !scanTarget.position) {
      setScanError('Coordonnees invalides');
      return;
    }
    setScanError('');
    scanMutation.mutate({
      targetGalaxy: scanTarget.galaxy,
      targetSystem: scanTarget.system,
      targetPosition: scanTarget.position,
    });
  };

  const styles = getHullCardStyles(hullId);
  const isActive = flagship.status === 'active';

  const allAbilities = hullConfig.abilities ?? [];
  const activeAbilities = allAbilities.filter((a) => (a as AbilityLite & { type?: string }).type === 'active');
  const hasActiveAbilities = activeAbilities.length > 0;

  return (
    <div className="space-y-4">
      {/* Passive effects — inline */}
      <div className={cn('glass-card p-4 lg:p-5 border', styles.border)}>
        <SectionHeader
          icon={<OverviewIcon width={14} height={14} />}
          label="Effets passifs"
          color={styles.badgeText}
        />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {(hullConfig.bonusLabels ?? []).map((label, i) => (
            <div
              key={i}
              className={cn('flex items-center gap-1.5 text-xs', !isActive && 'opacity-50')}
              title={isActive ? undefined : "Ne s'applique que lorsque le flagship est stationné"}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isActive ? 'bg-emerald-400' : 'bg-muted',
                )}
                aria-hidden
              />
              <span className={cn('font-medium', isActive ? 'text-slate-200' : 'text-slate-400')}>
                {label}
              </span>
            </div>
          ))}
        </div>
        {!isActive && (hullConfig.bonusLabels?.length ?? 0) > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground/70 italic">
            Les effets passifs ne s'appliquent que lorsque le flagship est stationné.
          </p>
        )}
      </div>

      {/* Active abilities — retro-card style */}
      {hasActiveAbilities && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Zap className={cn('h-3.5 w-3.5', styles.badgeText)} />
            <span className={cn('text-xs font-semibold uppercase tracking-wider', styles.badgeText)}>Capacites actives</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeAbilities.map((ability) => (
              <ActiveAbilityCard
                key={ability.id}
                ability={ability}
                cooldownData={flagshipData?.cooldowns?.[ability.id]}
                styles={styles}
                isActive={isActive}
                scanTarget={scanTarget}
                setScanTarget={setScanTarget}
                handleScan={handleScan}
                scanMutation={scanMutation}
                scanError={scanError}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
