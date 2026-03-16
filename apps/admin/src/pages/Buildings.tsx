import { useState } from 'react';
import { useGameConfig } from '@/hooks/useGameConfig';
import { trpc } from '@/trpc';
import { EditModal } from '@/components/ui/EditModal';
import { PageSkeleton } from '@/components/ui/LoadingSpinner';
import { Pencil, ChevronDown, ChevronRight } from 'lucide-react';

const FIELDS = [
  { key: 'name', label: 'Nom', type: 'text' as const },
  { key: 'description', label: 'Description', type: 'textarea' as const },
  { key: 'baseCostMinerai', label: 'Coût Minerai (base)', type: 'number' as const },
  { key: 'baseCostSilicium', label: 'Coût Silicium (base)', type: 'number' as const },
  { key: 'baseCostHydrogene', label: 'Coût Hydrogène (base)', type: 'number' as const },
  { key: 'costFactor', label: 'Facteur de cout', type: 'number' as const, step: '0.1' },
  { key: 'baseTime', label: 'Temps de base (s)', type: 'number' as const },
  { key: 'sortOrder', label: 'Ordre', type: 'number' as const },
];

const MAX_LEVEL = 25;

// Production-related building IDs mapped to their production config ID
const PRODUCTION_MAP: Record<string, string> = {
  mineraiMine: 'mineraiMine',
  siliciumMine: 'siliciumMine',
  hydrogeneSynth: 'hydrogeneSynth',
  solarPlant: 'solarPlant',
};

const STORAGE_IDS = ['storageMinerai', 'storageSilicium', 'storageHydrogene'];

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR');
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

interface LevelRow {
  level: number;
  costMinerai: number;
  costSilicium: number;
  costHydrogene: number;
  buildTime: number;
  production?: number;
  energy?: number;
  storageCapacity?: number;
}

function computeLevelRows(
  building: { baseCost: { minerai: number; silicium: number; hydrogene: number }; costFactor: number },
  productionConf: { baseProduction: number; exponentBase: number; energyConsumption: number | null; storageBase: number | null } | null,
  isStorage: boolean,
): LevelRow[] {
  const rows: LevelRow[] = [];
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const factor = Math.pow(building.costFactor, level - 1);
    const costMinerai = Math.floor(building.baseCost.minerai * factor);
    const costSilicium = Math.floor(building.baseCost.silicium * factor);
    const costHydrogene = Math.floor(building.baseCost.hydrogene * factor);
    const buildTime = Math.max(1, Math.floor(((costMinerai + costSilicium) / 2500) * 3600));

    const row: LevelRow = { level, costMinerai, costSilicium, costHydrogene, buildTime };

    if (isStorage && productionConf?.storageBase) {
      row.storageCapacity = productionConf.storageBase * Math.floor(2.5 * Math.exp((20 * level) / 33));
    } else if (productionConf && !isStorage) {
      row.production = Math.floor(productionConf.baseProduction * level * Math.pow(productionConf.exponentBase, level));
      if (productionConf.energyConsumption != null) {
        row.energy = Math.floor(productionConf.energyConsumption * level * Math.pow(productionConf.exponentBase, level));
      }
    }

    rows.push(row);
  }
  return rows;
}

export default function Buildings() {
  const { data, isLoading, refetch } = useGameConfig();
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const updateMutation = trpc.gameConfig.admin.updateBuilding.useMutation({
    onSuccess: () => {
      refetch();
      setEditing(null);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const buildings = Object.values(data.buildings).sort((a, b) => a.sortOrder - b.sortOrder);
  const editingBuilding = editing ? data.buildings[editing] : null;

  return (
    <div className="animate-fade-in">
      <h1 className="text-lg font-semibold text-gray-100 mb-4">Batiments</h1>

      <div className="admin-card overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>ID</th>
              <th>Nom</th>
              <th>Minerai</th>
              <th>Silicium</th>
              <th>H₂</th>
              <th>Facteur</th>
              <th>Temps</th>
              <th>Prerequis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((b) => {
              const isExpanded = expanded === b.id;
              const prodConfId = PRODUCTION_MAP[b.id];
              const prodConf = prodConfId ? data.production[prodConfId] : null;
              const isStorage = STORAGE_IDS.includes(b.id);
              const storageConf = isStorage ? data.production['storage'] : null;
              const effectiveConf = isStorage ? storageConf : prodConf;
              const hasProgression = !!effectiveConf || (!prodConf && !isStorage);
              const levelRows = isExpanded ? computeLevelRows(b, effectiveConf ?? null, isStorage) : [];

              // Determine which extra columns to show
              const showProduction = !!effectiveConf && !isStorage;
              const showEnergy = !!effectiveConf && effectiveConf.energyConsumption != null && !isStorage;
              const showStorage = isStorage && !!effectiveConf;
              const isSolar = b.id === 'solarPlant';

              return (
                <>
                  <tr key={b.id} className={isExpanded ? '[&>td]:border-b-0' : ''}>
                    <td className="!px-2">
                      {hasProgression && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : b.id)}
                          className="admin-btn-ghost p-1"
                        >
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-hull-400" />
                            : <ChevronRight className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                    <td className="font-mono text-xs text-gray-500">{b.id}</td>
                    <td className="font-medium">{b.name}</td>
                    <td className="font-mono text-sm">{b.baseCost.minerai}</td>
                    <td className="font-mono text-sm">{b.baseCost.silicium}</td>
                    <td className="font-mono text-sm">{b.baseCost.hydrogene}</td>
                    <td className="font-mono text-sm">{b.costFactor}</td>
                    <td className="font-mono text-sm">{b.baseTime}s</td>
                    <td className="text-xs text-gray-500">
                      {b.prerequisites.length > 0
                        ? b.prerequisites.map((p) => `${p.buildingId} ${p.level}`).join(', ')
                        : '-'}
                    </td>
                    <td>
                      <button
                        onClick={() => setEditing(b.id)}
                        className="admin-btn-ghost p-1.5"
                        title="Modifier"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${b.id}-levels`}>
                      <td colSpan={10} className="!p-0 !bg-panel/60">
                        <div className="px-6 py-3">
                          <div className="text-xs font-medium text-hull-400 mb-2 uppercase tracking-wider">
                            Progression niveaux 1–{MAX_LEVEL}
                            <span className="text-gray-500 normal-case tracking-normal ml-2">(temps sans usine de robots)</span>
                          </div>
                          <div className="max-h-[400px] overflow-y-auto rounded border border-panel-border/50">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-panel z-10">
                                <tr className="text-gray-500 uppercase tracking-wider">
                                  <th className="px-3 py-2 text-left font-medium">Niv.</th>
                                  <th className="px-3 py-2 text-right font-medium">Minerai</th>
                                  <th className="px-3 py-2 text-right font-medium">Silicium</th>
                                  <th className="px-3 py-2 text-right font-medium">H₂</th>
                                  <th className="px-3 py-2 text-right font-medium">Temps</th>
                                  {showProduction && (
                                    <th className="px-3 py-2 text-right font-medium">
                                      {isSolar ? 'Energie produite' : 'Production/h'}
                                    </th>
                                  )}
                                  {showEnergy && !isSolar && (
                                    <th className="px-3 py-2 text-right font-medium">Energie conso</th>
                                  )}
                                  {showStorage && (
                                    <th className="px-3 py-2 text-right font-medium">Capacite</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {levelRows.map((r) => (
                                  <tr key={r.level} className="border-t border-panel-border/30 hover:bg-panel-hover/50">
                                    <td className="px-3 py-1.5 font-mono font-medium text-hull-300">{r.level}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{formatNumber(r.costMinerai)}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{formatNumber(r.costSilicium)}</td>
                                    <td className="px-3 py-1.5 font-mono text-right">{formatNumber(r.costHydrogene)}</td>
                                    <td className="px-3 py-1.5 font-mono text-right text-gray-400">{formatTime(r.buildTime)}</td>
                                    {showProduction && (
                                      <td className="px-3 py-1.5 font-mono text-right text-emerald-400">
                                        {formatNumber(r.production!)}
                                      </td>
                                    )}
                                    {showEnergy && !isSolar && (
                                      <td className="px-3 py-1.5 font-mono text-right text-amber-400">
                                        -{formatNumber(r.energy!)}
                                      </td>
                                    )}
                                    {showStorage && (
                                      <td className="px-3 py-1.5 font-mono text-right text-sky-400">
                                        {formatNumber(r.storageCapacity!)}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingBuilding && (
        <EditModal
          open={!!editing}
          title={`Modifier: ${editingBuilding.name}`}
          fields={FIELDS}
          values={{
            name: editingBuilding.name,
            description: editingBuilding.description,
            baseCostMinerai: editingBuilding.baseCost.minerai,
            baseCostSilicium: editingBuilding.baseCost.silicium,
            baseCostHydrogene: editingBuilding.baseCost.hydrogene,
            costFactor: editingBuilding.costFactor,
            baseTime: editingBuilding.baseTime,
            sortOrder: editingBuilding.sortOrder,
          }}
          onSave={(values) => {
            updateMutation.mutate({
              id: editing!,
              data: {
                name: values.name as string,
                description: values.description as string,
                baseCostMinerai: values.baseCostMinerai as number,
                baseCostSilicium: values.baseCostSilicium as number,
                baseCostHydrogene: values.baseCostHydrogene as number,
                costFactor: values.costFactor as number,
                baseTime: values.baseTime as number,
                sortOrder: values.sortOrder as number,
              },
            });
          }}
          onClose={() => setEditing(null)}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
