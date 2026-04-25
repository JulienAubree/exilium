import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { trpc } from '@/trpc';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const FLAGSHIP_STATS = [
  { key: 'weapons', label: 'Armes' },
  { key: 'shield', label: 'Bouclier' },
  { key: 'hull', label: 'Coque' },
  { key: 'baseArmor', label: 'Armure' },
  { key: 'shotCount', label: 'Tirs' },
  { key: 'baseSpeed', label: 'Vitesse' },
  { key: 'fuelConsumption', label: 'Carburant' },
  { key: 'cargoCapacity', label: 'Cargo' },
];

export function FlagshipSection({
  flagship,
  userId,
  onSaved,
}: {
  flagship: any;
  userId: string;
  onSaved: () => void;
}) {
  const [stats, setStats] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    for (const { key } of FLAGSHIP_STATS) s[key] = flagship[key] ?? 0;
    return s;
  });
  const [confirmRepair, setConfirmRepair] = useState(false);

  const updateMut = trpc.playerAdmin.updateFlagshipStats.useMutation({ onSuccess: onSaved });
  const repairMut = trpc.playerAdmin.repairFlagship.useMutation({
    onSuccess: () => { onSaved(); setConfirmRepair(false); },
  });

  const isIncapacitated = flagship.status === 'incapacitated';

  return (
    <div className="admin-card p-4 mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-200">{flagship.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
            isIncapacitated ? 'text-red-400 bg-red-900/20' :
            flagship.status === 'in_mission' ? 'text-blue-400 bg-blue-900/20' :
            'text-emerald-400 bg-emerald-900/20'
          }`}>
            {flagship.status}
          </span>
          <span className="text-xs text-gray-500 font-mono">propulsion: {flagship.driveType}</span>
        </div>
        <div className="flex gap-2">
          {isIncapacitated && (
            <button onClick={() => setConfirmRepair(true)} className="admin-btn-primary py-1 px-3 text-xs flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Reparer
            </button>
          )}
        </div>
      </div>

      {isIncapacitated && flagship.repairEndsAt && (
        <div className="text-xs text-red-400/80 mb-3">
          Reparation prevue : {new Date(flagship.repairEndsAt).toLocaleString('fr-FR')}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {FLAGSHIP_STATS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-16 text-right shrink-0">{label}</label>
            <input
              type="number"
              value={stats[key]}
              onChange={(e) => setStats({ ...stats, [key]: Number(e.target.value) })}
              className="admin-input w-20 py-1 text-xs font-mono"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => updateMut.mutate({ userId, stats })}
        disabled={updateMut.isPending}
        className="admin-btn-primary py-1 px-3 text-xs"
      >
        {updateMut.isPending ? '...' : 'Sauver stats'}
      </button>

      <ConfirmDialog
        open={confirmRepair}
        title="Reparer le flagship ?"
        message="Le flagship sera remis en etat actif immediatement."
        confirmLabel="Reparer"
        onConfirm={() => repairMut.mutate({ userId })}
        onCancel={() => setConfirmRepair(false)}
      />
    </div>
  );
}
