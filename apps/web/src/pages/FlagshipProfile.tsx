import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/trpc';
import { HullChangeModal } from '@/components/flagship/HullChangeModal';
import { IncapacitatedBanner } from '@/components/flagship/IncapacitatedBanner';
import { HullRefitBanner } from '@/components/flagship/HullRefitBanner';
import { HullAbilitiesPanel } from '@/components/flagship/HullAbilitiesPanel';
import { FlagshipHero } from '@/components/flagship/FlagshipHero';
import { FlagshipHelp } from '@/components/flagship/FlagshipHelp';
import { FlagshipStatsClearCard } from '@/components/flagship/FlagshipStatsClearCard';
import { FlagshipImagePicker } from '@/components/flagship/FlagshipImagePicker';
import { FlagshipSkeleton } from '@/components/flagship/FlagshipSkeleton';
import { DEFAULT_HULL_ID } from '@exilium/shared';

interface PlanetLite {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
  planetClassId?: string | null;
  planetImageIndex?: number | null;
}

export default function FlagshipProfile() {
  const utils = trpc.useUtils();
  const { data: flagship, isLoading } = trpc.flagship.get.useQuery();
  const { data: flagshipImages } = trpc.flagship.listImages.useQuery(
    { hullId: (flagship?.hullId ?? 'industrial') as 'combat' | 'industrial' | 'scientific' },
    { enabled: !!flagship },
  );
  const { data: planets } = trpc.planet.list.useQuery();
  const { data: exiliumData } = trpc.exilium.getBalance.useQuery();
  const balance = exiliumData?.balance ?? 0;

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showHullChange, setShowHullChange] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const imageMutation = trpc.flagship.updateImage.useMutation({
    onSuccess: () => utils.flagship.get.invalidate(),
  });

  const handleRepaired = useCallback(() => {
    utils.flagship.get.invalidate();
  }, [utils.flagship.get]);

  // Find planet where flagship is stationed
  const stationedPlanet = useMemo<PlanetLite | null>(() => {
    if (!flagship || !planets) return null;
    return (planets as PlanetLite[]).find((p) => p.id === flagship.planetId) ?? null;
  }, [flagship, planets]);

  if (isLoading) return <FlagshipSkeleton />;

  if (!flagship) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">Vous n'avez pas encore de vaisseau amiral.</p>
        </div>
      </div>
    );
  }

  const isIncapacitated = flagship.status === 'incapacitated' && flagship.repairEndsAt;
  const isHullRefit = flagship.status === 'hull_refit' && (flagship as { refitEndsAt?: string | Date }).refitEndsAt;

  const hullConfig = 'hullConfig' in flagship
    ? (flagship as { hullConfig: { id: string; name: string; description: string } | null }).hullConfig
    : null;

  function handleImageSelect(imageIndex: number) {
    imageMutation.mutate({ imageIndex });
    setShowImagePicker(false);
  }

  return (
    <div className="space-y-4 lg:space-y-6 pb-6">
      <FlagshipHero
        flagship={flagship}
        hullConfig={hullConfig}
        stationedPlanet={stationedPlanet}
        onOpenImagePicker={() => setShowImagePicker(true)}
        onOpenHullChange={() => setShowHullChange(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />

      {(isIncapacitated || isHullRefit) && (
        <div className="px-3 sm:px-4 lg:px-6 space-y-3">
          {isIncapacitated && (
            <IncapacitatedBanner
              name={flagship.name}
              repairEndsAt={new Date(flagship.repairEndsAt!)}
              flagshipImageIndex={flagship.flagshipImageIndex}
              hullId={flagship.hullId ?? DEFAULT_HULL_ID}
              onRepaired={handleRepaired}
              balance={balance}
            />
          )}
          {isHullRefit && (
            <HullRefitBanner
              name={flagship.name}
              refitEndsAt={new Date((flagship as { refitEndsAt: string | Date }).refitEndsAt)}
              onComplete={handleRepaired}
            />
          )}
        </div>
      )}

      <div className="px-3 sm:px-4 lg:px-6">
        <div className="lg:max-w-md space-y-4">
          <FlagshipStatsClearCard
            flagship={{
              shield: flagship.shield,
              baseArmor: flagship.baseArmor,
              hull: flagship.hull,
              weapons: flagship.weapons,
              shotCount: flagship.shotCount,
              hullId: flagship.hullId,
              status: flagship.status,
            }}
          />
          {hullConfig && (
            <HullAbilitiesPanel
              flagship={flagship}
              hullConfig={hullConfig}
              hullId={flagship.hullId ?? DEFAULT_HULL_ID}
            />
          )}
        </div>
      </div>

      <FlagshipImagePicker
        open={showImagePicker}
        hullId={flagship.hullId ?? DEFAULT_HULL_ID}
        currentImageIndex={flagship.flagshipImageIndex}
        images={flagshipImages ?? []}
        onSelect={handleImageSelect}
        onClose={() => setShowImagePicker(false)}
      />

      <HullChangeModal
        open={showHullChange}
        onClose={() => setShowHullChange(false)}
        flagship={flagship}
      />

      <FlagshipHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
