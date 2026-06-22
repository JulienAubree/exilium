import { useNavigate } from 'react-router';
import { GameImage } from '@/components/common/GameImage';
import { Timer } from '@/components/common/Timer';
import { getUnitName } from '@/lib/entity-names';

interface BuildingActivity {
  id: string;
  name: string;
  currentLevel: number;
  nextLevelTime: number;
  upgradeEndTime: string;
}

interface QueueItem {
  id: string;
  itemId: string;
  type: 'ship' | 'defense';
  quantity: number;
  completedCount?: number;
  startTime: string;
  endTime: string | null;
  status: string;
  facilityId: string | null;
}

interface OverviewActivitiesProps {
  activeBuilding: BuildingActivity | undefined;
  shipyardQueue: QueueItem[];
  planetId: string;
  planetClassId?: string | null;
  gameConfig: any;
  onBuildingComplete: () => void;
  onShipyardComplete: () => void;
}

function ActiveSlot({ icon, label, sublabel, endTime, startTime, totalDuration, color, onClick, onComplete }: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  endTime: string;
  startTime?: string;
  totalDuration: number;
  color: string;
  onClick: () => void;
  onComplete: () => void;
}) {
  return (
    <div
      className="flex-1 min-w-[140px] p-2.5 rounded-lg bg-card/60 border border-white/[0.06] cursor-pointer hover:bg-card/80 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{label}</div>
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        </div>
      </div>
      <div className="h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-1000"
          style={{ background: color, width: `${Math.min(100, Math.max(0, ((Date.now() - new Date(startTime ?? endTime).getTime()) / (new Date(endTime).getTime() - new Date(startTime ?? endTime).getTime())) * 100))}%` }}
        />
      </div>
      <div className="mt-1">
        <Timer
          endTime={new Date(endTime)}
          totalDuration={totalDuration}
          className="text-xs"
          onComplete={onComplete}
        />
      </div>
    </div>
  );
}

function EmptySlot({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
  return (
    <div
      className="flex-1 min-w-[140px] p-2.5 rounded-lg bg-card/30 border border-dashed border-white/[0.08] cursor-pointer hover:bg-card/40 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-white/[0.04]" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-xs text-muted-foreground-soft mt-2">{cta} →</div>
    </div>
  );
}

export function OverviewActivities({
  activeBuilding, shipyardQueue, planetId: _planetId, planetClassId, gameConfig,
  onBuildingComplete, onShipyardComplete,
}: OverviewActivitiesProps) {
  const navigate = useNavigate();

  // Fusion des chantiers : une seule file, jusqu'à plusieurs cales actives.
  const activeShipBatches = shipyardQueue.filter((q) => q.status === 'active' && q.endTime);
  const tabFor = (type: string) => (type === 'defense' ? 'defenses' : 'vaisseaux');

  return (
    <div className="flex gap-3 overflow-x-auto">
      {/* Construction slot */}
      {activeBuilding ? (
        <ActiveSlot
          icon={<GameImage category="buildings" id={activeBuilding.id} size="icon" alt={activeBuilding.name} planetClassId={planetClassId} className="w-5 h-5 rounded flex-shrink-0" />}
          label={activeBuilding.name}
          sublabel={`Niv. ${activeBuilding.currentLevel + 1}`}
          endTime={activeBuilding.upgradeEndTime}
          totalDuration={activeBuilding.nextLevelTime}
          color="#38bdf8"
          onClick={() => navigate('/buildings')}
          onComplete={onBuildingComplete}
        />
      ) : (
        <EmptySlot label="Aucune construction" cta="Lancer" onClick={() => navigate('/buildings')} />
      )}

      {/* Cales du chantier (file unique, jusqu'à plusieurs productions actives) */}
      {activeShipBatches.length > 0 ? (
        activeShipBatches.map((batch) => (
          <ActiveSlot
            key={batch.id}
            icon={<GameImage category={batch.type === 'defense' ? 'defenses' : 'ships'} id={batch.itemId} size="icon" alt={getUnitName(batch.itemId, gameConfig)} planetClassId={planetClassId} className="w-5 h-5 rounded flex-shrink-0" />}
            label={getUnitName(batch.itemId, gameConfig)}
            sublabel={`x${batch.quantity - (batch.completedCount ?? 0)}`}
            endTime={batch.endTime!}
            startTime={batch.startTime}
            totalDuration={Math.floor((new Date(batch.endTime!).getTime() - new Date(batch.startTime).getTime()) / 1000)}
            color="#f59e0b"
            onClick={() => navigate(`/production?tab=${tabFor(batch.type)}`)}
            onComplete={onShipyardComplete}
          />
        ))
      ) : (
        <EmptySlot label="Aucune production en cours" cta="Lancer une production" onClick={() => navigate('/production?tab=vaisseaux')} />
      )}
    </div>
  );
}
