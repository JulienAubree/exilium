import { useState, useMemo } from 'react';
import { trpc } from '@/trpc';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { cn } from '@/lib/utils';

const BRANCH_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  combattant: { border: 'border-red-500/40', text: 'text-red-400', bg: 'bg-red-950/30' },
  explorateur: { border: 'border-teal-500/40', text: 'text-teal-400', bg: 'bg-teal-950/30' },
  negociant: { border: 'border-amber-500/40', text: 'text-amber-400', bg: 'bg-amber-950/30' },
};

const EFFECT_LABELS: Record<string, { label: string; color: string }> = {
  modify_stat: { label: 'Stat', color: 'text-blue-400' },
  global_bonus: { label: 'Global', color: 'text-amber-400' },
  planet_bonus: { label: 'Planete', color: 'text-emerald-400' },
  timed_buff: { label: 'Actif', color: 'text-pink-400' },
  unlock: { label: 'Deblocage', color: 'text-purple-400' },
};

const TIER_THRESHOLDS: Record<number, number> = { 1: 0, 2: 5, 3: 10, 4: 15, 5: 20 };

function getTierCost(tier: number) {
  return tier;
}

interface TalentTreeProps {
  showResetButton?: boolean;
  showGuide?: boolean;
}

export function TalentTree({ showResetButton = true, showGuide = false }: TalentTreeProps) {
  const utils = trpc.useUtils();
  const { data: talentTree } = trpc.talent.list.useQuery();
  const { data: exiliumData } = trpc.exilium.getBalance.useQuery();
  const balance = exiliumData?.balance ?? 0;

  const [confirmInvest, setConfirmInvest] = useState<string | null>(null);
  const [confirmRespec, setConfirmRespec] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const investMutation = trpc.talent.invest.useMutation({
    onSuccess: () => {
      utils.talent.list.invalidate();
      utils.flagship.get.invalidate();
      utils.exilium.getBalance.invalidate();
      setConfirmInvest(null);
    },
  });

  const respecMutation = trpc.talent.respec.useMutation({
    onSuccess: () => {
      utils.talent.list.invalidate();
      utils.flagship.get.invalidate();
      utils.exilium.getBalance.invalidate();
      setConfirmRespec(null);
    },
  });

  const resetMutation = trpc.talent.resetAll.useMutation({
    onSuccess: () => {
      utils.talent.list.invalidate();
      utils.flagship.get.invalidate();
      utils.exilium.getBalance.invalidate();
      setConfirmReset(false);
    },
  });

  const activateMutation = trpc.talent.activate.useMutation({
    onSuccess: () => {
      utils.talent.list.invalidate();
    },
  });

  const branchData = useMemo(() => {
    if (!talentTree) return [];
    return talentTree.branches.map(branch => {
      const branchTalents = Object.values(talentTree.talents)
        .filter(t => t.branchId === branch.id)
        .sort((a, b) => a.tier - b.tier || a.sortOrder - b.sortOrder);

      const tiers: Record<number, typeof branchTalents> = {};
      for (const t of branchTalents) {
        if (!tiers[t.tier]) tiers[t.tier] = [];
        tiers[t.tier].push(t);
      }

      const totalPoints = branchTalents.reduce((sum, t) => sum + (talentTree.ranks[t.id] ?? 0), 0);

      return { branch, tiers, talents: branchTalents, totalPoints };
    });
  }, [talentTree]);

  if (!talentTree) return null;

  function getInvestBlockReason(talentId: string): string | null {
    if (!talentTree) return 'Chargement…';
    const def = talentTree.talents[talentId];
    if (!def) return null;
    const rank = talentTree.ranks[talentId] ?? 0;
    if (rank >= def.maxRanks) return null;
    const bp = branchData.find(b => b.branch.id === def.branchId);
    const needed = TIER_THRESHOLDS[def.tier] ?? 0;
    const pts = bp?.totalPoints ?? 0;
    if (pts < needed) return `${needed - pts} pts manquants`;
    if (def.prerequisiteId && (talentTree.ranks[def.prerequisiteId] ?? 0) < 1) {
      const prereqName = talentTree.talents[def.prerequisiteId]?.name ?? def.prerequisiteId;
      return `Requiert : ${prereqName}`;
    }
    if (balance < getTierCost(def.tier)) return `${getTierCost(def.tier)} Exilium requis`;
    return null;
  }

  return (
    <>
      {showResetButton && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Arbre de talents</h3>
          <button
            onClick={() => setConfirmReset(true)}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Reinitialiser tout
          </button>
        </div>
      )}

      {showGuide && (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <button
            onClick={() => setGuideOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="font-medium">Comment fonctionnent les talents ?</span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={cn('transition-transform duration-200', guideOpen && 'rotate-180')}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {guideOpen && (
            <div className="px-4 pb-4 text-xs text-muted-foreground/80 space-y-2 border-t border-white/[0.04] pt-3">
              <p>
                Votre vaisseau amiral possede un arbre de talents reparti en <strong className="text-foreground">3 branches de specialisation</strong> :
                Combattant, Explorateur et Negociant. Chaque branche modifie votre style de jeu et offre des bonus uniques.
              </p>
              <p>
                Les talents sont repartis en <strong className="text-foreground">5 tiers</strong>. Pour debloquer un tier superieur,
                vous devez investir un certain nombre de points dans la branche. Le cout en Exilium augmente avec le tier (1 Exilium au tier 1, 5 au tier 5).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
                {Object.entries(EFFECT_LABELS).map(([key, { label, color }]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full', color.replace('text-', 'bg-'))} />
                    <span className="text-[10px]">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground/50">
                Vous pouvez reinitialiser un talent individuel ou tout l'arbre. Gratuit pendant la phase de developpement.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {branchData.map(({ branch, tiers, totalPoints }) => {
          const colors = BRANCH_COLORS[branch.id] ?? BRANCH_COLORS.combattant;
          return (
            <div key={branch.id} className={cn('rounded-lg border p-3 space-y-3', colors.border, colors.bg)}>
              <div className="text-center">
                <h3 className={cn('text-sm font-bold uppercase tracking-wider', colors.text)}>{branch.name}</h3>
                <p className="text-[10px] text-muted-foreground">{branch.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Points : {totalPoints}</p>
              </div>

              {[1, 2, 3, 4, 5].map(tier => {
                const tierTalents = tiers[tier] ?? [];
                if (tierTalents.length === 0) return null;
                const unlocked = totalPoints >= (TIER_THRESHOLDS[tier] ?? 0);

                return (
                  <div key={tier}>
                    <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wide mb-1">
                      Tier {tier} — {getTierCost(tier)} Exilium/rang
                      {!unlocked && ` (${TIER_THRESHOLDS[tier]} pts dans la branche requis)`}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {tierTalents.map(talent => {
                        const rank = talentTree.ranks[talent.id] ?? 0;
                        const maxed = rank >= talent.maxRanks;
                        const blockReason = !maxed ? getInvestBlockReason(talent.id) : null;
                        const available = !maxed && !blockReason;
                        const effectInfo = EFFECT_LABELS[talent.effectType];
                        const cooldown = talentTree.cooldowns[talent.id];
                        const isOnCooldown = cooldown && new Date() < new Date(cooldown.cooldownEnds);
                        const isBuffActive = cooldown && new Date() < new Date(cooldown.expiresAt);

                        return (
                          <div
                            key={talent.id}
                            className={cn(
                              'rounded-md border p-2 text-center text-[10px] space-y-1 transition-all',
                              talent.position === 'center' && tierTalents.length === 1 && 'col-span-3',
                              maxed ? 'border-primary/50 bg-primary/10' : rank > 0 ? 'border-primary/30' : 'border-border/50',
                              !unlocked && 'opacity-40',
                            )}
                          >
                            <div className="font-semibold leading-tight">{talent.name}</div>
                            <div className={cn('text-[8px]', effectInfo?.color)}>{effectInfo?.label}</div>
                            <div className="text-muted-foreground text-[8px] leading-tight">{talent.description}</div>
                            <div className="font-mono text-[9px]">{rank}/{talent.maxRanks}</div>

                            {blockReason && (
                              <div className="text-[8px] text-orange-400/80">{blockReason}</div>
                            )}

                            <div className="flex gap-1 justify-center flex-wrap">
                              {available && (
                                <button
                                  onClick={() => setConfirmInvest(talent.id)}
                                  className="text-[8px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                                >
                                  +1
                                </button>
                              )}
                              {rank > 0 && (
                                <button
                                  onClick={() => setConfirmRespec(talent.id)}
                                  className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                >
                                  Respec
                                </button>
                              )}
                              {talent.effectType === 'timed_buff' && rank > 0 && (
                                <button
                                  onClick={() => activateMutation.mutate({ talentId: talent.id })}
                                  disabled={!!isOnCooldown}
                                  className={cn(
                                    'text-[8px] px-1.5 py-0.5 rounded transition-colors',
                                    isBuffActive ? 'bg-pink-500/20 text-pink-400' :
                                    isOnCooldown ? 'bg-muted text-muted-foreground cursor-not-allowed' :
                                    'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20',
                                  )}
                                >
                                  {isBuffActive ? 'Actif' : isOnCooldown ? 'CD' : 'Activer'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!confirmInvest}
        onConfirm={() => { if (confirmInvest) investMutation.mutate({ talentId: confirmInvest }); }}
        onCancel={() => setConfirmInvest(null)}
        title="Investir dans ce talent ?"
        description={`Cout : ${confirmInvest && talentTree ? getTierCost(talentTree.talents[confirmInvest]?.tier ?? 1) : 0} Exilium`}
        confirmLabel="Investir"
      />

      <ConfirmDialog
        open={!!confirmRespec}
        onConfirm={() => { if (confirmRespec) respecMutation.mutate({ talentId: confirmRespec }); }}
        onCancel={() => setConfirmRespec(null)}
        title="Reinitialiser ce talent ?"
        description="Les talents dependants seront aussi reinitialises. Gratuit pendant la phase de developpement."
        variant="destructive"
        confirmLabel="Reinitialiser"
      />

      <ConfirmDialog
        open={confirmReset}
        onConfirm={() => resetMutation.mutate()}
        onCancel={() => setConfirmReset(false)}
        title="Reinitialiser tout l'arbre ?"
        description="Tous vos talents seront reinitialises. Gratuit pendant la phase de developpement."
        variant="destructive"
        confirmLabel="Tout reinitialiser"
      />
    </>
  );
}
