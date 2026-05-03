import { useState, useMemo, useCallback } from 'react';
import { trpc } from '@/trpc';
import { PageHeader } from '@/components/common/PageHeader';
import { HullChangeModal } from '@/components/flagship/HullChangeModal';
import { IncapacitatedBanner } from '@/components/flagship/IncapacitatedBanner';
import { HullRefitBanner } from '@/components/flagship/HullRefitBanner';
import { HullAbilitiesPanel } from '@/components/flagship/HullAbilitiesPanel';
import { FlagshipIdentityCard } from '@/components/flagship/FlagshipIdentityCard';
import { FlagshipStatsCard } from '@/components/flagship/FlagshipStatsCard';
import { FlagshipImagePicker } from '@/components/flagship/FlagshipImagePicker';
import { FlagshipSkeleton } from '@/components/flagship/FlagshipSkeleton';
import { ModuleLoadoutGrid } from '@/components/flagship/ModuleLoadoutGrid';
import { ModuleInventoryPanel } from '@/components/flagship/ModuleInventoryPanel';
import { ModuleDetailModal } from '@/components/flagship/ModuleDetailModal';
import { ModuleHullTabs } from '@/components/flagship/ModuleHullTabs';
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
  const { data: exiliumData } = trpc.exilium.getBalance.useQuery();
  const { data: planets } = trpc.planet.list.useQuery();
  const balance = exiliumData?.balance ?? 0;

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showHullChange, setShowHullChange] = useState(false);

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
        <PageHeader title="Vaisseau amiral" />
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">Vous n'avez pas encore de vaisseau amiral.</p>
        </div>
      </div>
    );
  }

  const isIncapacitated = flagship.status === 'incapacitated' && flagship.repairEndsAt;
  const isHullRefit = flagship.status === 'hull_refit' && (flagship as { refitEndsAt?: string | Date }).refitEndsAt;

  const effectiveStats = 'effectiveStats' in flagship
    ? (flagship as { effectiveStats: Record<string, number | string> | null }).effectiveStats
    : null;
  const hullConfig = 'hullConfig' in flagship
    ? (flagship as { hullConfig: { id: string; name: string; description: string } | null }).hullConfig
    : null;
  const driveType = (effectiveStats?.driveType as string | undefined) ?? flagship.driveType;

  function handleImageSelect(imageIndex: number) {
    imageMutation.mutate({ imageIndex });
    setShowImagePicker(false);
  }

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Vaisseau amiral" />

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

      <FlagshipIdentityCard
        flagship={flagship}
        hullConfig={hullConfig}
        flagshipImages={flagshipImages}
        stationedPlanet={stationedPlanet}
        balance={balance}
        onOpenImagePicker={() => setShowImagePicker(true)}
        onOpenHullChange={() => setShowHullChange(true)}
      />

      {hullConfig && (
        <HullAbilitiesPanel
          flagship={flagship}
          hullConfig={hullConfig}
          hullId={flagship.hullId ?? DEFAULT_HULL_ID}
        />
      )}

      <FlagshipStatsCard
        flagship={flagship}
        effectiveStats={effectiveStats as Parameters<typeof FlagshipStatsCard>[0]['effectiveStats']}
        driveType={driveType}
      />

      <ModulesTab activeHullId={flagship.hullId ?? DEFAULT_HULL_ID} />

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
    </div>
  );
}

function ModulesTab({ activeHullId }: { activeHullId: string }) {
  const [selectedHull, setSelectedHull] = useState(activeHullId);
  const [pendingSlot, setPendingSlot] = useState<{ slotType: 'epic' | 'rare' | 'common'; slotIndex: number } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: inventory } = trpc.modules.inventory.list.useQuery();
  const { data: loadout, refetch: refetchLoadout } = trpc.modules.loadout.get.useQuery({ hullId: selectedHull });
  const { data: allModules } = trpc.modules.list.useQuery();
  const utils = trpc.useUtils();

  const equipMutation = trpc.modules.loadout.equip.useMutation({
    onSuccess: () => { utils.modules.loadout.get.invalidate(); refetchLoadout(); setPendingSlot(null); },
  });
  const unequipMutation = trpc.modules.loadout.unequip.useMutation({
    onSuccess: () => { utils.modules.loadout.get.invalidate(); refetchLoadout(); },
  });

  const inventoryMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; image: string; rarity: string }>();
    for (const m of allModules ?? []) map.set(m.id, { id: m.id, name: m.name, image: m.image, rarity: m.rarity });
    return map;
  }, [allModules]);

  const slot = loadout?.slot ?? { epic: null, rare: [], common: [] };
  // Slots are fixed-length arrays with `null` placeholders for empty cells —
  // filter so the equipped set only contains real ids.
  const equippedIds = new Set<string>([
    ...(slot.epic ? [slot.epic] : []),
    ...(slot.rare as (string | null)[]).filter((x): x is string => typeof x === 'string'),
    ...(slot.common as (string | null)[]).filter((x): x is string => typeof x === 'string'),
  ]);

  const detailModule = detailId
    ? (inventory?.items ?? []).find((i) => i.moduleId === detailId)
    : null;

  return (
    <div className="space-y-4">
      <ModuleHullTabs activeHullId={activeHullId} selectedHull={selectedHull} onSelect={setSelectedHull} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
        <div>
          <ModuleLoadoutGrid
            slot={slot}
            inventory={inventoryMap}
            onSlotClick={(slotType, slotIndex) => setPendingSlot({ slotType, slotIndex })}
            onUnequip={(slotType, slotIndex) => unequipMutation.mutate({ hullId: selectedHull, slotType, slotIndex })}
          />
          {loadout && (
            <div className="mt-4 text-center text-xs text-muted-foreground font-mono">
              ⚡ Charges épiques : {loadout.epicChargesCurrent} / {loadout.epicChargesMax}
            </div>
          )}
        </div>
        <ModuleInventoryPanel
          items={(inventory?.items ?? []).filter((i) => i.hullId === selectedHull)}
          hullFilter={selectedHull}
          selectedSlotType={pendingSlot?.slotType ?? null}
          equippedIds={equippedIds}
          onEquip={(moduleId) => {
            if (pendingSlot) {
              equipMutation.mutate({ hullId: selectedHull, ...pendingSlot, moduleId });
            }
          }}
          onDetails={(moduleId) => setDetailId(moduleId)}
        />
      </div>
      <ModuleDetailModal
        module={detailModule ? {
          id: detailModule.moduleId, name: detailModule.name, description: detailModule.description,
          rarity: detailModule.rarity, hullId: detailModule.hullId, image: detailModule.image,
          effect: detailModule.effect, count: detailModule.count,
        } : null}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
