import { useState, useCallback, useMemo } from 'react';
import { SlidersHorizontal, ChevronDown } from 'lucide-react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/lib/utils';
import { buildProductionConfig } from '@/lib/production-config';
import { solarSatelliteEnergy, calculateShieldCapacity } from '@exilium/game-engine';
import { MineraiIcon, SiliciumIcon, HydrogeneIcon, EnergieIcon } from '@/components/common/ResourceIcons';
import { DefenseIcon } from '@/lib/icons';
import { EnergyBar } from '@/components/energy/EnergyBar';
import { FluxView } from '@/components/energy/FluxView';

const SOLAR_PLANT_ID = 'solarPlant';

/**
 * Bloc de gestion de l'énergie de la planète — extrait de l'ancienne page
 * /energy pour être posé sur la Vue d'ensemble (refonte IA : « fusionner
 * énergie dans Vue d'ensemble »). Bilan énergie visible au coup d'œil + sliders
 * de réglage de la production dans un repli (ne re-surcharge pas l'Overview).
 * Les sliders gardent la même mécanique (mutations resource.setProductionPercent
 * / setShieldPercent).
 */
export function PlanetEnergyPanel({ planetId }: { planetId?: string }) {
  const utils = trpc.useUtils();
  const { data: gameConfig } = useGameConfig();
  const { isOpen, toggle } = useDisclosure();
  const [localPercents, setLocalPercents] = useState<Record<string, number>>({});

  const { data } = trpc.resource.production.useQuery({ planetId: planetId! }, { enabled: !!planetId });
  const { data: buildings } = trpc.building.list.useQuery({ planetId: planetId! }, { enabled: !!planetId });

  const setPercentMutation = trpc.resource.setProductionPercent.useMutation({
    onSuccess: () => utils.resource.production.invalidate({ planetId: planetId! }),
  });
  const setShieldMutation = trpc.resource.setShieldPercent.useMutation({
    onSuccess: () => utils.resource.production.invalidate({ planetId: planetId! }),
  });

  const handlePercentChange = useCallback((key: string, value: number) => {
    setLocalPercents((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePercentChangeEnd = useCallback(
    (key: string, value: number) => {
      setLocalPercents((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (key === 'shield') {
        setShieldMutation.mutate({ planetId: planetId!, percent: value });
      } else {
        setPercentMutation.mutate({ planetId: planetId!, [key]: value });
      }
    },
    [planetId, setPercentMutation, setShieldMutation],
  );

  const prodConfig = useMemo(() => (gameConfig ? buildProductionConfig(gameConfig) : undefined), [gameConfig]);

  const solarPlant = buildings?.find((b) => b.id === SOLAR_PLANT_ID);
  const solarMaxed = solarPlant != null && solarPlant.maxLevel != null && solarPlant.currentLevel >= solarPlant.maxLevel;
  const shieldLevel = buildings?.find((b) => b.id === 'planetaryShield')?.currentLevel ?? 0;

  if (!data) return null;

  const isHomePlanet = data.planetClassId === 'homeworld';
  const satEnergyPerUnit = solarSatelliteEnergy(data.maxTemp, isHomePlanet, prodConfig?.satellite);
  const satCount = data.levels.solarSatelliteCount;
  const satEnergyTotal = satEnergyPerUnit * satCount;
  const plantEnergy = data.rates.energyProduced - satEnergyTotal;
  const shieldPercent = localPercents['shield'] ?? data.rates.shieldPercent ?? 100;

  const energySegments = [
    { label: 'Mine Min.', value: data.rates.mineraiMineEnergyConsumption, color: '#fb923c' },
    { label: 'Mine Sil.', value: data.rates.siliciumMineEnergyConsumption, color: '#34d399' },
    { label: 'Synth. H₂', value: data.rates.hydrogeneSynthEnergyConsumption, color: '#60a5fa' },
    ...(shieldLevel > 0 ? [{ label: 'Bouclier', value: data.rates.shieldEnergyConsumption, color: '#22d3ee' }] : []),
  ];

  const energySources = [
    { name: 'Centrale Solaire', icon: <EnergieIcon size={20} />, energy: plantEnergy, detail: `Niveau ${data.levels.solarPlant}` },
    ...(satCount > 0
      ? [{ name: 'Satellites Solaires', icon: <EnergieIcon size={20} />, energy: satEnergyTotal, detail: `${satCount} × ${satEnergyPerUnit}` }]
      : []),
  ];

  const consumers = [
    {
      key: 'mineraiMinePercent',
      name: 'Mine Minerai',
      icon: <MineraiIcon size={18} />,
      level: data.levels.mineraiMine,
      colorHex: '#fb923c',
      colorClass: 'text-minerai',
      percent: localPercents['mineraiMinePercent'] ?? data.rates.mineraiMinePercent,
      energyConsumption: data.rates.mineraiMineEnergyConsumption,
      production: `+${data.rates.mineraiPerHour.toLocaleString('fr-FR')}/h`,
      productionLabel: 'Produit',
      productionUnit: '/heure',
    },
    {
      key: 'siliciumMinePercent',
      name: 'Mine Silicium',
      icon: <SiliciumIcon size={18} />,
      level: data.levels.siliciumMine,
      colorHex: '#34d399',
      colorClass: 'text-silicium',
      percent: localPercents['siliciumMinePercent'] ?? data.rates.siliciumMinePercent,
      energyConsumption: data.rates.siliciumMineEnergyConsumption,
      production: `+${data.rates.siliciumPerHour.toLocaleString('fr-FR')}/h`,
      productionLabel: 'Produit',
      productionUnit: '/heure',
    },
    {
      key: 'hydrogeneSynthPercent',
      name: 'Synth. H₂',
      icon: <HydrogeneIcon size={18} />,
      level: data.levels.hydrogeneSynth,
      colorHex: '#60a5fa',
      colorClass: 'text-hydrogene',
      percent: localPercents['hydrogeneSynthPercent'] ?? data.rates.hydrogeneSynthPercent,
      energyConsumption: data.rates.hydrogeneSynthEnergyConsumption,
      production: `+${data.rates.hydrogenePerHour.toLocaleString('fr-FR')}/h`,
      productionLabel: 'Produit',
      productionUnit: '/heure',
    },
    ...(shieldLevel > 0
      ? [{
          key: 'shield',
          name: 'Bouclier',
          icon: <DefenseIcon width={18} height={18} />,
          level: shieldLevel,
          colorHex: '#22d3ee',
          colorClass: 'text-shield',
          percent: shieldPercent,
          energyConsumption: data.rates.shieldEnergyConsumption,
          production: `${Math.floor(calculateShieldCapacity(shieldLevel) * shieldPercent / 100)}/tour`,
          productionLabel: 'Capacité',
          productionUnit: '/tour',
        }]
      : []),
  ];

  const isMutating = setPercentMutation.isPending || setShieldMutation.isPending;

  return (
    <div className="space-y-3">
      {/* Bilan énergie — au coup d'œil */}
      <EnergyBar
        totalProduced={data.rates.energyProduced}
        totalConsumed={data.rates.energyConsumed}
        segments={energySegments}
        productionFactor={data.rates.productionFactor}
        solarMaxed={solarMaxed}
      />

      {/* Réglage de la production — repli (ex-onglet Énergie) */}
      <div className="glass-card overflow-hidden">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex min-h-[44px] w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:border-border-strong"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-display text-sm font-semibold tracking-tight text-foreground">Réglage de la production</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">Sliders d'énergie par bâtiment</span>
          <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
        </button>
        {isOpen && (
          <div className="border-t border-border/60 p-4">
            <FluxView
              sources={energySources}
              consumers={consumers}
              onPercentChange={handlePercentChange}
              onPercentChangeEnd={handlePercentChangeEnd}
              disabled={isMutating}
            />
          </div>
        )}
      </div>
    </div>
  );
}
