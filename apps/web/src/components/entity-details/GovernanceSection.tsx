import { trpc } from '@/trpc';

/**
 * Section spécifique au bâtiment "Centre de Pouvoir Imperial" :
 * affiche la capacité de gouvernance, les colonies actives, l'overextend,
 * et la progression / les pénalités par niveau.
 */
export function GovernanceSection({ currentLevel }: { currentLevel: number }) {
  const { data: governance } = trpc.colonization.governance.useQuery();

  // Use server-side capacity when available so the panel stays consistent
  // with the governance alert/penalty computation (which reads the homeworld
  // IPC, not the currently-viewed planet's row).
  const capacity = governance?.capacity ?? (1 + currentLevel);
  const colonyCount = governance?.colonyCount ?? 0;
  const overextend = governance?.overextend ?? 0;

  const penaltySteps = [
    { step: 1, harvest: 15, construction: 15 },
    { step: 2, harvest: 35, construction: 35 },
    { step: 3, harvest: 60, construction: 60 },
  ];

  return (
    <div className="space-y-3">
      {/* Current status */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 space-y-2">
        <div className="text-[10px] uppercase text-amber-400 font-semibold tracking-wider">Gouvernance impériale</div>
        <div className="text-xs text-slate-300 space-y-1.5">
          <p>Chaque niveau augmente votre <span className="text-amber-400 font-medium">capacité de gouvernance</span> de +1 planète. Au-delà de votre capacité, toutes vos colonies subissent des pénalités.</p>

          <div className="rounded bg-[#0d1628] px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span>Capacité actuelle</span>
              <span className="font-semibold text-amber-400">{capacity} planète{capacity > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Colonies actives</span>
              <span className={overextend > 0 ? 'font-semibold text-red-400' : 'font-semibold text-emerald-400'}>
                {colonyCount}
              </span>
            </div>
            {overextend > 0 && (
              <div className="flex items-center justify-between text-red-400 border-t border-slate-700 pt-1 mt-1">
                <span>Dépassement</span>
                <span className="font-semibold">+{overextend}</span>
              </div>
            )}
          </div>

          {overextend > 0 && (
            <p className="text-red-400 text-[11px]">
              Pénalités en cours : -{Math.round((governance?.harvestMalus ?? 0) * 100)}% récolte, +{Math.round((governance?.constructionMalus ?? 0) * 100)}% temps construction sur toutes vos colonies.
            </p>
          )}
        </div>
      </div>

      {/* Progression table */}
      <div>
        <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-2">
          Capacité par niveau
        </div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-slate-500 text-left">
              <th className="px-2 py-1.5 border-b border-[#1e293b]">Niveau</th>
              <th className="px-2 py-1.5 border-b border-[#1e293b] text-right text-amber-500">Capacité</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {Array.from({ length: 6 }, (_, i) => currentLevel + i).map((level, i) => (
              <tr key={level} className={i % 2 === 0 ? 'bg-[#1e293b]' : ''}>
                <td className={`px-2 py-1.5 ${i === 0 ? 'font-semibold text-emerald-400' : ''}`}>
                  {level}{i === 0 ? ' \u25C4' : ''}
                </td>
                <td className="px-2 py-1.5 text-right text-amber-400">
                  {1 + level} planète{1 + level > 1 ? 's' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Penalty table */}
      <div>
        <div className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider mb-2">
          Penalites d&apos;overextend
        </div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-slate-500 text-left">
              <th className="px-2 py-1.5 border-b border-[#1e293b]">Depassement</th>
              <th className="px-2 py-1.5 border-b border-[#1e293b] text-right text-red-500">Recolte</th>
              <th className="px-2 py-1.5 border-b border-[#1e293b] text-right text-red-500">Construction</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {penaltySteps.map((row, i) => (
              <tr key={row.step} className={i % 2 === 0 ? 'bg-[#1e293b]' : ''}>
                <td className={`px-2 py-1.5 ${overextend === row.step ? 'font-semibold text-red-400' : ''}`}>
                  +{row.step}{overextend === row.step ? ' \u25C4' : ''}
                </td>
                <td className="px-2 py-1.5 text-right text-red-500">-{row.harvest}%</td>
                <td className="px-2 py-1.5 text-right text-red-500">+{row.construction}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
