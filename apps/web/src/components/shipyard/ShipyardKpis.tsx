import { KpiTile } from '@/components/common/KpiTile';

interface ShipyardKpisProps {
  stationedCount: number;
  buildingCount: number;
  activeBatches: number;
}

export function ShipyardKpis({ stationedCount, buildingCount, activeBatches }: ShipyardKpisProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <KpiTile
        label="Vaisseaux stationnés"
        value={stationedCount.toLocaleString('fr-FR')}
        color="text-cyan-400"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 12l10 10 10-10z" />
          </svg>
        }
      />
      <KpiTile
        label="En construction"
        value={buildingCount}
        color="text-amber-400"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
          </svg>
        }
      />
      <KpiTile
        label="En cours"
        value={activeBatches}
        color="text-emerald-400"
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        }
      />
    </div>
  );
}
