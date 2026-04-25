import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { trpc } from '@/trpc';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export function TalentsSection({
  talents,
  flagshipId,
  gameConfig,
  onSaved,
}: {
  talents: any[];
  flagshipId: string;
  gameConfig: any;
  onSaved: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const resetMut = trpc.playerAdmin.resetFlagshipTalents.useMutation({
    onSuccess: () => { onSaved(); setConfirmReset(false); },
  });

  const talentDefs = gameConfig?.talents ?? {};
  const invested = talents.filter((t: any) => t.currentRank > 0);

  return (
    <div className="admin-card p-4 mb-8">
      {invested.length === 0 ? (
        <div className="text-sm text-gray-500">Aucun talent investi.</div>
      ) : (
        <div className="space-y-1 mb-3">
          {invested.map((t: any) => {
            const def = talentDefs[t.talentId];
            return (
              <div key={t.talentId} className="flex items-center justify-between bg-panel rounded px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-200">{def?.name ?? t.talentId}</span>
                  <span className="text-xs text-gray-500 font-mono">({t.talentId})</span>
                </div>
                <span className="font-mono text-sm text-purple-400">
                  {t.currentRank}/{def?.maxRanks ?? '?'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {invested.length > 0 && (
        <button
          onClick={() => setConfirmReset(true)}
          className="admin-btn-ghost text-xs text-red-400 flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> Reinitialiser tous les talents
        </button>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reinitialiser les talents ?"
        message="Tous les talents du flagship seront remis a zero. L'Exilium ne sera pas rembourse."
        danger
        confirmLabel="Reinitialiser"
        onConfirm={() => resetMut.mutate({ flagshipId })}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
