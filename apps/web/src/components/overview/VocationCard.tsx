import { useState } from 'react';
import { Pickaxe, Factory, Scale } from 'lucide-react';
import { trpc } from '@/trpc';
import { cn } from '@/lib/utils';
import { useGameConfig } from '@/hooks/useGameConfig';
import { useToastStore } from '@/stores/toast.store';

type Vocation = 'miniere' | 'industrielle' | null;

/**
 * Spécialisation du monde (chantier Empire v1) : choisir une vocation —
 * un bonus fort contre un malus réel. Premier choix gratuit, reconversion
 * payante avec cooldown. Spec : docs/plans/2026-06-10-specialisation-mondes-v1.md
 */
export function VocationCard({ planetId, planetClassId, vocation, vocationChangedAt }: {
  planetId: string;
  planetClassId: string | null;
  vocation: string | null;
  vocationChangedAt: string | null;
}) {
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const { data: gameConfig } = useGameConfig();
  const { data: progression } = trpc.empireProgression.get.useQuery();
  const [pendingChoice, setPendingChoice] = useState<Vocation | undefined>(undefined);

  const mutation = trpc.planet.setVocation.useMutation({
    onSuccess: () => {
      setPendingChoice(undefined);
      utils.planet.invalidate();
      utils.resource.production.invalidate({ planetId });
      addToast('Vocation mise à jour — les effets sont immédiats.', 'success');
    },
    onError: (e) => {
      setPendingChoice(undefined);
      addToast(e.message, 'error');
    },
  });

  if (planetClassId === 'homeworld') return null;

  const universe = gameConfig?.universe ?? {};
  const unlockLevel = Number(universe['vocation_unlock_level']) || 5;
  const level = progression?.level ?? 1;
  const locked = level < unlockLevel;

  const prodBonus = Math.round((Number(universe['vocation_miniere_production_bonus']) || 0.2) * 100);
  const prodMalusM = Math.round((Number(universe['vocation_miniere_construction_malus']) || 0.15) * 100);
  const consBonus = Math.round((Number(universe['vocation_industrielle_construction_bonus']) || 0.2) * 100);
  const consMalusP = Math.round((Number(universe['vocation_industrielle_production_malus']) || 0.1) * 100);
  const costM = Number(universe['vocation_reconversion_minerai']) || 50000;
  const costS = Number(universe['vocation_reconversion_silicium']) || 25000;
  const cooldownH = Number(universe['vocation_cooldown_hours']) || 168;

  const isFirstChoice = vocationChangedAt == null;
  const readyAt = vocationChangedAt
    ? new Date(vocationChangedAt).getTime() + cooldownH * 3600 * 1000
    : 0;
  const onCooldown = !isFirstChoice && Date.now() < readyAt;
  const hoursLeft = onCooldown ? Math.ceil((readyAt - Date.now()) / 3600 / 1000) : 0;

  const OPTIONS: { id: Vocation; label: string; icon: React.ReactNode; effect: string }[] = [
    { id: 'miniere', label: 'Monde minier', icon: <Pickaxe className="h-4 w-4" />, effect: `+${prodBonus} % production · +${prodMalusM} % temps de construction` },
    { id: 'industrielle', label: 'Monde-forge', icon: <Factory className="h-4 w-4" />, effect: `−${consBonus} % temps de construction · −${consMalusP} % production` },
    { id: null, label: 'Équilibrée', icon: <Scale className="h-4 w-4" />, effect: 'Aucun bonus, aucun malus' },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Vocation du monde</span>
        {locked ? (
          <span className="text-xs text-muted-foreground">Niveau d'empire {unlockLevel} requis (actuel : {level})</span>
        ) : onCooldown ? (
          <span className="text-xs tabular-nums text-amber-400">Reconversion dans {hoursLeft} h</span>
        ) : !isFirstChoice ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            Reconversion : {costM.toLocaleString('fr-FR')} minerai + {costS.toLocaleString('fr-FR')} silicium
          </span>
        ) : (
          <span className="text-xs text-emerald-400">Premier choix gratuit</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const isActive = (vocation ?? null) === opt.id;
          const isPendingConfirm = pendingChoice === opt.id;
          const disabled = locked || onCooldown || isActive || mutation.isPending;
          return (
            <button
              key={opt.label}
              type="button"
              disabled={disabled && !isPendingConfirm}
              onClick={() => {
                if (isPendingConfirm) {
                  mutation.mutate({ planetId, vocation: opt.id });
                } else {
                  setPendingChoice(opt.id);
                }
              }}
              onBlur={() => setPendingChoice(undefined)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors duration-fast',
                isActive
                  ? 'border-primary/50 bg-primary/10'
                  : disabled
                    ? 'border-border opacity-50 cursor-not-allowed'
                    : isPendingConfirm
                      ? 'border-amber-500/60 bg-amber-500/10'
                      : 'border-border hover:border-border-strong',
              )}
            >
              <span className={cn('flex items-center gap-2 text-sm font-medium', isActive ? 'text-primary' : 'text-foreground')}>
                {opt.icon}
                {opt.label}
                {isActive && <span className="ml-auto text-xs text-primary">active</span>}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {isPendingConfirm
                  ? (isFirstChoice ? 'Cliquer à nouveau pour confirmer' : `Confirmer (${costM.toLocaleString('fr-FR')} Fe + ${costS.toLocaleString('fr-FR')} Si, cooldown ${Math.round(cooldownH / 24)} j)`)
                  : opt.effect}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
