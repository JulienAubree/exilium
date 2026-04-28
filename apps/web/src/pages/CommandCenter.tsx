import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router';
import { trpc } from '@/trpc';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useTutorialTargetId } from '@/hooks/useTutorialHighlight';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { EntityDetailOverlay } from '@/components/common/EntityDetailOverlay';
import { ShipDetailContent } from '@/components/entity-details/ShipDetailContent';
import { FacilityHero } from '@/components/common/FacilityHero';
import { FacilityLockedHero } from '@/components/common/FacilityLockedHero';
import { FacilityQueue } from '@/components/common/FacilityQueue';
import { BuildingUpgradeCard } from '@/components/common/BuildingUpgradeCard';
import { ShipCard } from '@/components/shipyard/ShipCard';
import { ShipMobileRow } from '@/components/shipyard/ShipMobileRow';
import { CommandCenterHelp } from '@/components/command-center/CommandCenterHelp';
import { getShipName } from '@/lib/entity-names';

export default function CommandCenter() {
  const { planetId, planetClassId } = useOutletContext<{ planetId?: string; planetClassId?: string | null }>();
  const utils = trpc.useUtils();
  const { data: gameConfig } = useGameConfig();
  const tutorialTargetId = useTutorialTargetId();

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  useEffect(() => { setQuantities({}); }, [planetId]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: buildings } = trpc.building.list.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );
  const commandCenterBuilding = buildings?.find((b) => b.id === 'commandCenter');
  const commandCenterLevel = commandCenterBuilding?.currentLevel ?? 0;

  const { data: ships, isLoading } = trpc.shipyard.ships.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const { data: resourceData } = trpc.resource.production.useQuery(
    { planetId: planetId! },
    { enabled: !!planetId },
  );

  const resources = useResourceCounter(
    resourceData
      ? {
          minerai: resourceData.minerai,
          silicium: resourceData.silicium,
          hydrogene: resourceData.hydrogene,
          resourcesUpdatedAt: resourceData.resourcesUpdatedAt,
          mineraiPerHour: resourceData.rates.mineraiPerHour,
          siliciumPerHour: resourceData.rates.siliciumPerHour,
          hydrogenePerHour: resourceData.rates.hydrogenePerHour,
          storageMineraiCapacity: resourceData.rates.storageMineraiCapacity,
          storageSiliciumCapacity: resourceData.rates.storageSiliciumCapacity,
          storageHydrogeneCapacity: resourceData.rates.storageHydrogeneCapacity,
        }
      : undefined,
  );

  const { data: queue } = trpc.shipyard.queue.useQuery(
    { planetId: planetId!, facilityId: 'commandCenter' },
    { enabled: !!planetId },
  );

  const { data: researchData } = trpc.research.list.useQuery();
  const researchList = researchData?.items;

  const researchLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    researchList?.forEach((r) => { levels[r.id] = r.currentLevel; });
    return levels;
  }, [researchList]);

  const buildingLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    buildings?.forEach((b) => { levels[b.id] = b.currentLevel; });
    return levels;
  }, [buildings]);

  const buildMutation = trpc.shipyard.buildShip.useMutation({
    onSuccess: () => {
      utils.shipyard.ships.invalidate({ planetId: planetId! });
      utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'commandCenter' });
      utils.resource.production.invalidate({ planetId: planetId! });
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
    },
  });

  const cancelMutation = trpc.shipyard.cancelBatch.useMutation({
    onSuccess: () => {
      utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'commandCenter' });
      utils.shipyard.ships.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
      setCancelConfirm(null);
    },
  });

  const reduceMutation = trpc.shipyard.reduceQuantity.useMutation({
    onSuccess: () => {
      utils.shipyard.queue.invalidate();
      utils.shipyard.ships.invalidate();
      utils.shipyard.defenses.invalidate();
      utils.resource.production.invalidate();
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
    },
  });

  const upgradeMutation = trpc.building.upgrade.useMutation({
    onSuccess: () => {
      utils.building.list.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
    },
  });

  const buildingCancelMutation = trpc.building.cancel.useMutation({
    onSuccess: () => {
      utils.building.list.invalidate({ planetId: planetId! });
      utils.resource.production.invalidate({ planetId: planetId! });
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
    },
  });

  const shipQueue = queue ?? [];
  const isAnyBuildingUpgrading = buildings?.some((b) => b.isUpgrading) ?? false;

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading || !ships) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Centre de commandement" />
        <CardGridSkeleton count={6} />
      </div>
    );
  }

  // ── Locked state ──────────────────────────────────────────────────────
  if (buildings && commandCenterLevel < 1) {
    return (
      <FacilityLockedHero
        buildingId="commandCenter"
        title="Centre de commandement"
        planetClassId={planetClassId}
        description={<>Construisez le <span className="text-foreground font-semibold">Centre de commandement</span> pour assembler les vaisseaux militaires de votre flotte.</>}
      >
        {commandCenterBuilding && (
          <BuildingUpgradeCard
            currentLevel={commandCenterBuilding.currentLevel}
            nextLevelCost={commandCenterBuilding.nextLevelCost}
            nextLevelTime={commandCenterBuilding.nextLevelTime}
            prerequisites={commandCenterBuilding.prerequisites as any}
            isUpgrading={!!commandCenterBuilding.isUpgrading}
            upgradeEndTime={commandCenterBuilding.upgradeEndTime ?? null}
            resources={{ minerai: resources.minerai, silicium: resources.silicium, hydrogene: resources.hydrogene }}
            buildingLevels={buildingLevels}
            isAnyUpgrading={isAnyBuildingUpgrading}
            upgradePending={upgradeMutation.isPending}
            cancelPending={buildingCancelMutation.isPending}
            gameConfig={gameConfig}
            onUpgrade={() => upgradeMutation.mutate({ planetId: planetId!, buildingId: 'commandCenter' as any })}
            onCancel={() => buildingCancelMutation.mutate({ planetId: planetId! })}
            onTimerComplete={() => {
              utils.building.list.invalidate({ planetId: planetId! });
              utils.resource.production.invalidate({ planetId: planetId! });
            }}
          />
        )}
      </FacilityLockedHero>
    );
  }

  // ── Combat ships only (this page handles ship_combat; other ships are at shipyard) ──
  const combatShips = ships.filter((s) => gameConfig?.ships[s.id]?.categoryId === 'ship_combat');

  // ── Per-ship derivations ──────────────────────────────────────────────
  const derivations = new Map<string, { qty: number; maxAffordable: number; canAfford: boolean; highlighted: boolean }>();
  for (const ship of combatShips) {
    const qty = quantities[ship.id] || 1;
    const maxAffordable = Math.max(1, Math.min(
      ship.cost.minerai > 0 ? Math.floor(resources.minerai / ship.cost.minerai) : 9999,
      ship.cost.silicium > 0 ? Math.floor(resources.silicium / ship.cost.silicium) : 9999,
      ship.cost.hydrogene > 0 ? Math.floor(resources.hydrogene / ship.cost.hydrogene) : 9999,
      9999,
    ));
    const canAfford =
      resources.minerai >= ship.cost.minerai * qty &&
      resources.silicium >= ship.cost.silicium * qty &&
      resources.hydrogene >= ship.cost.hydrogene * qty;
    derivations.set(ship.id, { qty, maxAffordable, canAfford, highlighted: tutorialTargetId === ship.id });
  }

  // ── Main layout ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <FacilityHero
        buildingId="commandCenter"
        title="Centre de commandement"
        level={commandCenterLevel}
        planetClassId={resourceData?.planetClassId}
        planetImageIndex={resourceData?.planetImageIndex}
        onOpenHelp={() => setHelpOpen(true)}
        upgradeCard={commandCenterBuilding && (
          <BuildingUpgradeCard
            currentLevel={commandCenterBuilding.currentLevel}
            nextLevelCost={commandCenterBuilding.nextLevelCost}
            nextLevelTime={commandCenterBuilding.nextLevelTime}
            prerequisites={commandCenterBuilding.prerequisites as any}
            isUpgrading={!!commandCenterBuilding.isUpgrading}
            upgradeEndTime={commandCenterBuilding.upgradeEndTime ?? null}
            resources={{ minerai: resources.minerai, silicium: resources.silicium, hydrogene: resources.hydrogene }}
            buildingLevels={buildingLevels}
            isAnyUpgrading={isAnyBuildingUpgrading}
            upgradePending={upgradeMutation.isPending}
            cancelPending={buildingCancelMutation.isPending}
            gameConfig={gameConfig}
            onUpgrade={() => upgradeMutation.mutate({ planetId: planetId!, buildingId: 'commandCenter' as any })}
            onCancel={() => buildingCancelMutation.mutate({ planetId: planetId! })}
            onTimerComplete={() => {
              utils.building.list.invalidate({ planetId: planetId! });
              utils.resource.production.invalidate({ planetId: planetId! });
            }}
          />
        )}
      >
        <FacilityQueue
          queue={shipQueue}
          items={ships}
          getItemName={(id) => getShipName(id, gameConfig)}
          itemNoun="vaisseau"
          itemNounPlural="vaisseaux"
          onTimerComplete={() => {
            utils.shipyard.queue.invalidate({ planetId: planetId!, facilityId: 'commandCenter' });
            utils.shipyard.ships.invalidate({ planetId: planetId! });
          }}
          onReduce={(batchId) => reduceMutation.mutate({ planetId: planetId!, batchId, removeCount: 1 })}
          onCancel={(batchId) => setCancelConfirm(batchId)}
          reducePending={reduceMutation.isPending}
          cancelPending={cancelMutation.isPending}
        />
      </FacilityHero>

      <div className="space-y-4 px-4 pb-4 lg:px-6 lg:pb-6">
        <section className="glass-card p-4 lg:p-5">
          {/* Mobile compact list */}
          <div className="space-y-1 lg:hidden">
            {combatShips.map((ship) => {
              const { qty, maxAffordable, canAfford, highlighted } = derivations.get(ship.id)!;
              return (
                <ShipMobileRow
                  key={ship.id}
                  ship={ship}
                  quantity={qty}
                  maxAffordable={maxAffordable}
                  canAfford={canAfford}
                  highlighted={highlighted}
                  buildPending={buildMutation.isPending}
                  onQuantityChange={(v) => setQuantities({ ...quantities, [ship.id]: v })}
                  onBuild={() => buildMutation.mutate({ planetId: planetId!, shipId: ship.id as any, quantity: qty })}
                  onOpenDetail={() => setDetailId(ship.id)}
                />
              );
            })}
          </div>

          {/* Desktop vertical card grid */}
          <div className="hidden lg:grid lg:gap-4 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            {combatShips.map((ship) => {
              const { qty, maxAffordable, canAfford, highlighted } = derivations.get(ship.id)!;
              return (
                <ShipCard
                  key={ship.id}
                  ship={ship}
                  quantity={qty}
                  maxAffordable={maxAffordable}
                  canAfford={canAfford}
                  highlighted={highlighted}
                  resources={{ minerai: resources.minerai, silicium: resources.silicium, hydrogene: resources.hydrogene }}
                  gameConfig={gameConfig}
                  buildingLevels={buildingLevels}
                  researchLevels={researchLevels}
                  buildPending={buildMutation.isPending}
                  onQuantityChange={(v) => setQuantities({ ...quantities, [ship.id]: v })}
                  onBuild={() => buildMutation.mutate({ planetId: planetId!, shipId: ship.id as any, quantity: qty })}
                  onOpenDetail={() => setDetailId(ship.id)}
                />
              );
            })}
          </div>
        </section>
      </div>

      {/* Detail overlay */}
      <EntityDetailOverlay
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detailId ? gameConfig?.ships[detailId]?.name ?? '' : ''}
      >
        {detailId && (
          <ShipDetailContent
            shipId={detailId}
            researchLevels={researchLevels}
            buildingLevels={buildingLevels}
            maxTemp={resourceData?.maxTemp}
            isHomePlanet={resourceData?.planetClassId === 'homeworld'}
            timePerUnit={ships?.find((s) => s.id === detailId)?.timePerUnit}
          />
        )}
      </EntityDetailOverlay>

      {/* Help overlay */}
      <EntityDetailOverlay open={helpOpen} onClose={() => setHelpOpen(false)} title="Centre de commandement">
        <CommandCenterHelp level={commandCenterLevel} planetClassId={planetClassId} />
      </EntityDetailOverlay>

      <ConfirmDialog
        open={!!cancelConfirm}
        onConfirm={() => cancelConfirm && cancelMutation.mutate({ planetId: planetId!, batchId: cancelConfirm })}
        onCancel={() => setCancelConfirm(null)}
        title="Annuler la production ?"
        description="Les unités restantes seront annulées. Le remboursement est proportionnel au temps restant, plafonné à 70% des ressources investies. Les unités déjà produites sont conservées."
        confirmLabel="Annuler la production"
        variant="destructive"
      />
    </div>
  );
}
