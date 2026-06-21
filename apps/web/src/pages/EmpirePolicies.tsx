import { Crown, Check } from 'lucide-react';
import { trpc } from '@/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToastStore } from '@/stores/toast.store';
import { cn } from '@/lib/utils';

function signedPct(delta: number): string {
  const p = Math.round(delta * 100);
  return `${p > 0 ? '+' : ''}${p} %`;
}

interface EffectLine {
  label: string;
  value: string;
  good: boolean;
}

function summarizeEffects(e: {
  productionDelta: number;
  exiliumGainMult: number;
  buildTimeMult: { building: number; ship: number; defense: number };
  fleetSlotBonus: number;
}): EffectLine[] {
  const lines: EffectLine[] = [];
  if (e.productionDelta !== 0)
    lines.push({ label: 'Production', value: signedPct(e.productionDelta), good: e.productionDelta > 0 });
  if (e.exiliumGainMult !== 1)
    lines.push({ label: 'Gains d’exilium', value: signedPct(e.exiliumGainMult - 1), good: e.exiliumGainMult > 1 });
  // Temps de construction : un multiplicateur < 1 = plus rapide = bon.
  for (const [key, label] of [
    ['building', 'Constr. bâtiments'],
    ['ship', 'Constr. vaisseaux'],
    ['defense', 'Constr. défenses'],
  ] as const) {
    const m = e.buildTimeMult[key];
    if (m !== 1) lines.push({ label, value: signedPct(m - 1), good: m < 1 });
  }
  if (e.fleetSlotBonus !== 0)
    lines.push({ label: 'Slots de flotte', value: `+${e.fleetSlotBonus}`, good: e.fleetSlotBonus > 0 });
  return lines;
}

export default function EmpirePolicies() {
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.policy.get.useQuery();

  const setMutation = trpc.policy.set.useMutation({
    onSuccess: () => utils.policy.get.invalidate(),
    onError: (err) => addToast(err.message, 'error'),
  });

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement de la salle du trône…</div>;
  }

  const { axes, active, used, capacity, empireLevel, nextSwitchAt } = data;
  const effectLines = summarizeEffects(data.effects);
  const slotsFull = used >= capacity;

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            Salle du trône
          </h1>
          <p className="text-xs text-muted-foreground">
            Donne une posture à ton empire. Chaque choix est un arbitrage — pas de gain gratuit.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={slotsFull ? 'secondary' : 'default'}>
            {used}/{capacity} politique{capacity > 1 ? 's' : ''}
          </Badge>
          <span className="text-muted-foreground">Empire niv. {empireLevel}</span>
        </div>
      </div>

      {/* Effet net en vigueur */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs font-semibold text-foreground mb-2">Effet net en vigueur</div>
          {effectLines.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune politique active — empire neutre.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {effectLines.map((l) => (
                <span key={l.label} className="text-xs">
                  <span className="text-muted-foreground">{l.label} </span>
                  <span className={l.good ? 'text-emerald-400' : 'text-rose-400'}>{l.value}</span>
                </span>
              ))}
            </div>
          )}
          {slotsFull && (
            <p className="mt-2 text-xs text-amber-300">
              Capacité atteinte — désactive un axe ou monte ton niveau d’empire pour en activer un autre.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Axes */}
      <div className="space-y-3">
        {axes.map((axis) => {
          const current = active[axis.id] ?? null;
          const cooldownUntil = nextSwitchAt[axis.id];
          const locked = !!cooldownUntil;
          const options = [
            { id: null as string | null, label: 'Neutre', description: 'Aucun effet.' },
            ...axis.postures,
          ];

          return (
            <Card key={axis.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{axis.label}</h2>
                    <p className="text-xs text-muted-foreground">{axis.description}</p>
                  </div>
                  {locked && (
                    <span className="text-xs text-amber-300 shrink-0">
                      Verrouillé jusqu’au {new Date(cooldownUntil).toLocaleString('fr-FR')}
                    </span>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {options.map((opt) => {
                    const selected = current === opt.id;
                    const isNonNeutral = opt.id !== null;
                    // Verrou cooldown : on ne peut pas prendre une nouvelle posture, mais
                    // revenir au neutre reste possible. Capacité pleine : idem.
                    const blockedByCooldown = locked && isNonNeutral && !selected;
                    const blockedByCapacity = slotsFull && current === null && isNonNeutral;
                    const disabled =
                      setMutation.isPending || selected || blockedByCooldown || blockedByCapacity;

                    return (
                      <button
                        key={opt.id ?? 'neutre'}
                        type="button"
                        disabled={disabled}
                        onClick={() => setMutation.mutate({ axis: axis.id, posture: opt.id })}
                        className={cn(
                          'rounded-md border p-2.5 text-left transition-colors',
                          selected
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-border bg-card/40 hover:bg-card/70',
                          disabled && !selected && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{opt.label}</span>
                          {selected && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Changer de posture engage l’empire : un délai s’applique avant de pouvoir rebasculer cet axe.
        Revenir au neutre est toujours possible.
      </p>
    </div>
  );
}
