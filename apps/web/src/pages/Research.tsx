import { useState, useMemo } from 'react';
import { Home } from 'lucide-react';
import { trpc } from '@/trpc';
import { usePlanetStore } from '@/stores/planet.store';
import { useResourceCounter } from '@/hooks/useResourceCounter';
import { Button } from '@/components/ui/button';
import { CardGridSkeleton } from '@/components/common/PageSkeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { EntityDetailOverlay } from '@/components/common/EntityDetailOverlay';
import { ResearchDetailContent } from '@/components/entity-details/ResearchDetailContent';
import { useGameConfig } from '@/hooks/useGameConfig';
import { FacilityHero } from '@/components/common/FacilityHero';
import { FacilityLockedHero } from '@/components/common/FacilityLockedHero';
import { BuildingUpgradeCard } from '@/components/common/BuildingUpgradeCard';
import { ResearchActivePanel } from '@/components/research/ResearchActivePanel';
import { ResearchHelp } from '@/components/research/ResearchHelp';
import { BranchColumn } from '@/components/research/BranchColumn';
import { BRANCHES } from '@/components/research/research-tree.types';

const ANNEX_LAB_BY_PLANET_CLASS: Record<string, { id: string; name: string }> = {
  volcanic: { id: 'labVolcanic', name: 'Forge Volcanique' },
  arid: { id: 'labArid', name: 'Laboratoire Aride' },
  temperate: { id: 'labTemperate', name: 'Bio-Laboratoire' },
  glacial: { id: 'labGlacial', name: 'Cryo-Laboratoire' },
  gaseous: { id: 'labGaseous', name: 'Nebula-Lab' },
};

export default function Research() {
  const planetId = usePlanetStore((s) => s.activePlanetId);
  const setActivePlanet = usePlanetStore((s) => s.setActivePlanet);
  const utils = trpc.useUtils();
  const { data: gameConfig } = useGameConfig();

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: researchData, isLoading } = trpc.research.list.useQuery();
  const techs = researchData?.items;
  const bonuses = researchData?.bonuses;
  const forkChoices = researchData?.forkChoices ?? {};
  const labLevel = bonuses?.labLevel ?? 0;

  // ── Home planet (researchLab lives there) ─────────────────────────────
  const { data: planets } = trpc.planet.list.useQuery();
  const homePlanet = planets?.find((p) => p.planetClassId === 'homeworld');
  const currentPlanet = planets?.find((p) => p.id === planetId);
  const isOnColony = !!homePlanet && !!planetId && planetId !== homePlanet.id;

  const { data: homeBuildings } = trpc.building.list.useQuery(
    { planetId: homePlanet?.id ?? '' },
    { enabled: !!homePlanet?.id },
  );
  const { data: colonyBuildings } = trpc.building.list.useQuery(
    { planetId: planetId ?? '' },
    { enabled: !!planetId && isOnColony },
  );
  const researchLabBuilding = homeBuildings?.find((b) => b.id === 'researchLab');
  const isAnyBuildingUpgrading = homeBuildings?.some((b) => b.isUpgrading) ?? false;

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

  const craftRates = resourceData
    ? {
        mineraiPerHour: resourceData.rates.mineraiPerHour,
        siliciumPerHour: resourceData.rates.siliciumPerHour,
        hydrogenePerHour: resourceData.rates.hydrogenePerHour,
      }
    : undefined;

  const cancelMutation = trpc.research.cancel.useMutation({
    onSuccess: () => {
      utils.research.list.invalidate();
      if (planetId) utils.resource.production.invalidate({ planetId });
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
      setCancelConfirm(false);
    },
  });

  const upgradeMutation = trpc.building.upgrade.useMutation({
    onSuccess: () => {
      if (homePlanet?.id) utils.building.list.invalidate({ planetId: homePlanet.id });
      utils.research.list.invalidate();
      utils.resource.production.invalidate();
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
    },
  });

  const buildingCancelMutation = trpc.building.cancel.useMutation({
    onSuccess: () => {
      if (homePlanet?.id) utils.building.list.invalidate({ planetId: homePlanet.id });
      utils.resource.production.invalidate();
      utils.planet.empire.invalidate();
      utils.tutorial.getCurrent.invalidate();
    },
  });

  const researchLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    techs?.forEach((t) => {
      levels[t.id] = t.currentLevel;
    });
    return levels;
  }, [techs]);

  const buildingLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    if (bonuses) {
      levels['researchLab'] = bonuses.labLevel;
      for (const annex of bonuses.annexDetails) {
        levels[annex.buildingId] = annex.level;
      }
    }
    return levels;
  }, [bonuses]);

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading || !researchData || !techs) {
    return (
      <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
        <PageHeader title="Recherche" />
        <CardGridSkeleton count={6} />
      </div>
    );
  }

  // ── Colony view: lab vit sur la home, montrer l'annexe locale ─────────
  if (isOnColony && homePlanet && currentPlanet) {
    const annex = ANNEX_LAB_BY_PLANET_CLASS[currentPlanet.planetClassId ?? ''];
    const annexBuilding = annex ? colonyBuildings?.find((b) => b.id === annex.id) : undefined;
    const isAnyColonyUpgrading = colonyBuildings?.some((b) => b.isUpgrading) ?? false;
    const colonyBuildingLevels: Record<string, number> = {};
    colonyBuildings?.forEach((b) => {
      colonyBuildingLevels[b.id] = b.currentLevel;
    });

    return (
      <FacilityLockedHero
        buildingId={annex?.id ?? 'researchLab'}
        title={annex ? annex.name : 'Recherche'}
        planetClassId={currentPlanet?.planetClassId}
        description={
          annex ? (
            <>
              Le programme scientifique principal s'exécute depuis votre{' '}
              <span className="text-foreground font-semibold">planète-mère</span>. Cette colonie
              peut héberger une annexe spécialisée qui boostera l'ensemble de votre recherche.
            </>
          ) : (
            <>
              Le programme scientifique s'exécute depuis votre{' '}
              <span className="text-foreground font-semibold">planète-mère</span>.
            </>
          )
        }
      >
        <div className="flex flex-col items-center gap-3">
          {annex && annexBuilding && (
            <BuildingUpgradeCard
              currentLevel={annexBuilding.currentLevel}
              maxLevel={annexBuilding.maxLevel}
              nextLevelCost={annexBuilding.nextLevelCost}
              nextLevelTime={annexBuilding.nextLevelTime}
              prerequisites={annexBuilding.prerequisites as any}
              isUpgrading={!!annexBuilding.isUpgrading}
              upgradeEndTime={annexBuilding.upgradeEndTime ?? null}
              resources={{
                minerai: resources.minerai,
                silicium: resources.silicium,
                hydrogene: resources.hydrogene,
              }}
              buildingLevels={colonyBuildingLevels}
              isAnyUpgrading={isAnyColonyUpgrading}
              upgradePending={upgradeMutation.isPending}
              cancelPending={buildingCancelMutation.isPending}
              gameConfig={gameConfig}
              rates={craftRates}
              onUpgrade={() =>
                upgradeMutation.mutate({ planetId: planetId!, buildingId: annex.id as any })
              }
              onCancel={() => buildingCancelMutation.mutate({ planetId: planetId! })}
              onTimerComplete={() => {
                utils.building.list.invalidate({ planetId: planetId! });
                utils.resource.production.invalidate({ planetId: planetId! });
              }}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setActivePlanet(homePlanet.id)}
          >
            <Home className="h-3.5 w-3.5" />
            Voir le laboratoire principal
          </Button>
        </div>
      </FacilityLockedHero>
    );
  }

  // ── Locked state (lab not built) ──────────────────────────────────────
  if (bonuses && labLevel < 1) {
    return (
      <FacilityLockedHero
        buildingId="researchLab"
        title="Laboratoire de recherche"
        planetClassId={homePlanet?.planetClassId}
        description={
          <>
            Construisez le{' '}
            <span className="text-foreground font-semibold">Laboratoire de recherche</span> sur
            votre planète-mère pour démarrer le programme scientifique de votre empire.
          </>
        }
      >
        {researchLabBuilding && homePlanet && (
          <BuildingUpgradeCard
            currentLevel={researchLabBuilding.currentLevel}
            maxLevel={researchLabBuilding.maxLevel}
            nextLevelCost={researchLabBuilding.nextLevelCost}
            nextLevelTime={researchLabBuilding.nextLevelTime}
            prerequisites={researchLabBuilding.prerequisites as any}
            isUpgrading={!!researchLabBuilding.isUpgrading}
            upgradeEndTime={researchLabBuilding.upgradeEndTime ?? null}
            resources={{
              minerai: resources.minerai,
              silicium: resources.silicium,
              hydrogene: resources.hydrogene,
            }}
            buildingLevels={buildingLevels}
            isAnyUpgrading={isAnyBuildingUpgrading}
            upgradePending={upgradeMutation.isPending}
            cancelPending={buildingCancelMutation.isPending}
            gameConfig={gameConfig}
            rates={craftRates}
            onUpgrade={() =>
              upgradeMutation.mutate({ planetId: homePlanet.id, buildingId: 'researchLab' as any })
            }
            onCancel={() => buildingCancelMutation.mutate({ planetId: homePlanet.id })}
            onTimerComplete={() => {
              if (homePlanet.id) utils.building.list.invalidate({ planetId: homePlanet.id });
              utils.resource.production.invalidate();
            }}
          />
        )}
      </FacilityLockedHero>
    );
  }

  const researchingTech = techs.find((t) => t.isResearching && t.researchEndTime);
  const isAnyResearching = techs.some((t) => t.isResearching);

  // ── Group techs by branchId ───────────────────────────────────────────
  const techsByBranch = useMemo(() => {
    const map = new Map<string, typeof techs>();
    for (const tech of techs) {
      if (!tech.branchId) continue;
      const list = map.get(tech.branchId) ?? [];
      list.push(tech);
      map.set(tech.branchId, list);
    }
    return map;
  }, [techs]);

  // Techs without branchId (legacy) — render in a fallback flat section
  const legacyTechs = useMemo(
    () => techs.filter((t) => !t.branchId),
    [techs],
  );

  const resourcesObj = {
    minerai: resources.minerai,
    silicium: resources.silicium,
    hydrogene: resources.hydrogene,
  };

  const handleStartSuccess = () => {
    if (planetId) utils.resource.production.invalidate({ planetId });
  };

  // ── Main layout ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <FacilityHero
        buildingId="researchLab"
        title="Laboratoire de recherche"
        level={labLevel}
        planetClassId={homePlanet?.planetClassId}
        planetImageIndex={homePlanet?.planetImageIndex}
        onOpenHelp={() => setHelpOpen(true)}
        upgradeCard={
          researchLabBuilding &&
          homePlanet && (
            <BuildingUpgradeCard
              currentLevel={researchLabBuilding.currentLevel}
              maxLevel={researchLabBuilding.maxLevel}
              nextLevelCost={researchLabBuilding.nextLevelCost}
              nextLevelTime={researchLabBuilding.nextLevelTime}
              prerequisites={researchLabBuilding.prerequisites as any}
              isUpgrading={!!researchLabBuilding.isUpgrading}
              upgradeEndTime={researchLabBuilding.upgradeEndTime ?? null}
              resources={resourcesObj}
              buildingLevels={buildingLevels}
              isAnyUpgrading={isAnyBuildingUpgrading}
              upgradePending={upgradeMutation.isPending}
              cancelPending={buildingCancelMutation.isPending}
              gameConfig={gameConfig}
              rates={craftRates}
              onUpgrade={() =>
                upgradeMutation.mutate({
                  planetId: homePlanet.id,
                  buildingId: 'researchLab' as any,
                })
              }
              onCancel={() => buildingCancelMutation.mutate({ planetId: homePlanet.id })}
              onTimerComplete={() => {
                if (homePlanet.id) utils.building.list.invalidate({ planetId: homePlanet.id });
                utils.research.list.invalidate();
              }}
            />
          )
        }
      >
        {bonuses && (
          <ResearchActivePanel
            bonuses={bonuses}
            researchingTech={researchingTech ?? null}
            onTimerComplete={() => {
              utils.research.list.invalidate();
              utils.tutorial.getCurrent.invalidate();
            }}
            onCancel={() => setCancelConfirm(true)}
            cancelPending={cancelMutation.isPending}
          />
        )}
      </FacilityHero>

      <div className="space-y-6 px-4 pb-4 lg:px-6 lg:pb-6">
        {/* ── Branch tree view ── */}
        <section className="glass-card p-4 lg:p-5 space-y-8">
          {BRANCHES.map((branch) => {
            const branchItems = techsByBranch.get(branch.id);
            if (!branchItems || branchItems.length === 0) return null;
            return (
              <BranchColumn
                key={branch.id}
                branch={branch}
                items={branchItems}
                forkChoices={forkChoices}
                resources={resourcesObj}
                craftRates={craftRates}
                isAnyResearching={isAnyResearching}
                buildingLevels={buildingLevels}
                researchLevels={researchLevels}
                onStartSuccess={handleStartSuccess}
                onDetailOpen={setDetailId}
              />
            );
          })}

          {/* Fallback for legacy techs without branchId */}
          {legacyTechs.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <span className="h-px flex-1 bg-border/50" />
                Autres
                <span className="h-px flex-1 bg-border/50" />
              </h3>
              <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
                {legacyTechs.map((tech) => (
                  <BranchColumn
                    key={tech.id}
                    branch={{ id: '_legacy', label: '' }}
                    items={[tech]}
                    forkChoices={forkChoices}
                    resources={resourcesObj}
                    craftRates={craftRates}
                    isAnyResearching={isAnyResearching}
                    buildingLevels={buildingLevels}
                    researchLevels={researchLevels}
                    onStartSuccess={handleStartSuccess}
                    onDetailOpen={setDetailId}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Detail overlay */}
      <EntityDetailOverlay
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detailId ? (gameConfig?.research[detailId]?.name ?? '') : ''}
      >
        {detailId && (
          <ResearchDetailContent
            researchId={detailId}
            researchLevels={researchLevels}
            buildingLevels={buildingLevels}
          />
        )}
      </EntityDetailOverlay>

      {/* Help overlay */}
      <EntityDetailOverlay
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Laboratoire de recherche"
      >
        <ResearchHelp level={labLevel} planetClassId={homePlanet?.planetClassId} />
      </EntityDetailOverlay>

      <ConfirmDialog
        open={cancelConfirm}
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setCancelConfirm(false)}
        title="Annuler la recherche ?"
        description="Le remboursement est proportionnel au temps restant, plafonné à 70% des ressources investies."
        variant="destructive"
        confirmLabel="Annuler la recherche"
        cancelLabel="Continuer la recherche"
      />
    </div>
  );
}
