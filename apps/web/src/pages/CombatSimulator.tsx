import { useMemo, useState } from 'react';
import { Swords, Shield, Crosshair, RotateCcw, Zap, Link2 } from 'lucide-react';
import { trpc } from '@/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToastStore } from '@/stores/toast.store';
import { cn } from '@/lib/utils';

type Counts = Record<string, number>;

type CodexUnit = {
  id: string;
  name: string;
  kind: 'ship' | 'defense';
  categoryId: string;
  shield: number;
  hull: number;
  armor: number;
  weapons: {
    damage: number;
    shots: number;
    targetCategory: string;
    rafale?: { category: string; count: number };
    chainKill: boolean;
  }[];
};

const PRESET_RUNS = 200;

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Un sélecteur compact : nom de l'unité + champ d'effectif. */
function UnitPicker({
  units,
  values,
  onChange,
  catName,
}: {
  units: CodexUnit[];
  values: Counts;
  onChange: (id: string, n: number) => void;
  catName: (id: string) => string;
}) {
  return (
    <div className="space-y-1">
      {units.map((u) => (
        <div key={u.id} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-foreground truncate">{u.name}</div>
            <div className="text-xs text-muted-foreground">{catName(u.categoryId)}</div>
          </div>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={values[u.id] ? String(values[u.id]) : ''}
            placeholder="0"
            onChange={(e) => onChange(u.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="h-8 w-24 text-right"
          />
        </div>
      ))}
    </div>
  );
}

export default function CombatSimulator() {
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();

  const { data: codex, isLoading: codexLoading } = trpc.combat.codex.useQuery();
  const { data: presets = [] } = trpc.fleetPreset.list.useQuery();

  const [tab, setTab] = useState<'simulateur' | 'codex'>('simulateur');

  const [attacker, setAttacker] = useState<Counts>({});
  const [defShips, setDefShips] = useState<Counts>({});
  const [defDefenses, setDefDefenses] = useState<Counts>({});
  const [defenderTechLevel, setDefenderTechLevel] = useState(0);
  const [defenderShieldLevel, setDefenderShieldLevel] = useState(0);

  const [result, setResult] = useState<
    Awaited<ReturnType<typeof utils.combat.simulate.fetch>> | null
  >(null);
  const [running, setRunning] = useState(false);

  // Catalogues — la flotte amiral est exclue (stats dynamiques par joueur).
  const attackerShipList = useMemo(
    () => (codex?.units ?? []).filter((u) => u.kind === 'ship' && u.id !== 'flagship'),
    [codex],
  );
  const defenseList = useMemo(
    () => (codex?.units ?? []).filter((u) => u.kind === 'defense'),
    [codex],
  );
  const catName = useMemo(() => {
    const map = new Map((codex?.categories ?? []).map((c) => [c.id, c.name]));
    return (id: string) => map.get(id) ?? id;
  }, [codex]);

  const knownShipIds = useMemo(
    () => new Set(attackerShipList.map((u) => u.id)),
    [attackerShipList],
  );

  const loadPreset = (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    const next: Counts = {};
    for (const [shipId, n] of Object.entries(preset.ships)) {
      if (knownShipIds.has(shipId) && n > 0) next[shipId] = n;
    }
    setAttacker(next);
    addToast(`Composition « ${preset.name} » chargée`, 'success');
  };

  const totalAttacker = Object.values(attacker).reduce((a, b) => a + b, 0);
  const totalDefender =
    Object.values(defShips).reduce((a, b) => a + b, 0) +
    Object.values(defDefenses).reduce((a, b) => a + b, 0);

  const runSim = async () => {
    if (totalAttacker === 0) {
      addToast('Compose une flotte attaquante.', 'error');
      return;
    }
    setRunning(true);
    try {
      const res = await utils.combat.simulate.fetch({
        attackerShips: attacker,
        defenderShips: defShips,
        defenderDefenses: defDefenses,
        defenderShieldLevel,
        defenderTechLevel,
        runs: PRESET_RUNS,
      });
      setResult(res);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Échec de la simulation', 'error');
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setAttacker({});
    setDefShips({});
    setDefDefenses({});
    setDefenderTechLevel(0);
    setDefenderShieldLevel(0);
    setResult(null);
  };

  if (codexLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement du moteur de combat…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            Simulateur de combat
          </h1>
          <p className="text-xs text-muted-foreground">
            Confronte ta flotte (avec ta vraie recherche) à une composition adverse. Aucun effet réel.
          </p>
        </div>
        <div className="flex rounded-md border border-border bg-card/40 p-0.5 text-xs">
          {(['simulateur', 'codex'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded px-3 py-1.5 font-medium capitalize transition-colors',
                tab === t ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'codex' ? 'Codex des contres' : 'Simulateur'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'simulateur' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Attaquant */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Crosshair className="h-4 w-4 text-emerald-400" /> Ta flotte
                </h2>
                {presets.length > 0 && (
                  <select
                    aria-label="Charger un preset"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) loadPreset(e.target.value);
                      e.target.value = '';
                    }}
                    className="h-7 rounded-md border border-border bg-card/60 px-2 text-xs text-foreground/80"
                  >
                    <option value="" disabled>
                      Charger un preset…
                    </option>
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <UnitPicker
                units={attackerShipList}
                values={attacker}
                onChange={(id, n) => setAttacker((s) => ({ ...s, [id]: n }))}
                catName={catName}
              />
              <div className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                {totalAttacker.toLocaleString()} vaisseau{totalAttacker > 1 ? 'x' : ''}
              </div>
            </CardContent>
          </Card>

          {/* Défenseur */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-rose-400" /> Adversaire
              </h2>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Vaisseaux</div>
                <UnitPicker
                  units={attackerShipList}
                  values={defShips}
                  onChange={(id, n) => setDefShips((s) => ({ ...s, [id]: n }))}
                  catName={catName}
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Défenses</div>
                <UnitPicker
                  units={defenseList}
                  values={defDefenses}
                  onChange={(id, n) => setDefDefenses((s) => ({ ...s, [id]: n }))}
                  catName={catName}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-2">
                <label className="text-xs text-muted-foreground">
                  Niveau recherche combat
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={String(defenderTechLevel)}
                    onChange={(e) => setDefenderTechLevel(Math.max(0, Math.min(50, Math.floor(Number(e.target.value) || 0))))}
                    className="h-8 mt-1"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Bouclier planétaire (niv)
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={String(defenderShieldLevel)}
                    onChange={(e) => setDefenderShieldLevel(Math.max(0, Math.min(30, Math.floor(Number(e.target.value) || 0))))}
                    className="h-8 mt-1"
                  />
                </label>
              </div>
              <div className="text-xs text-muted-foreground">
                {totalDefender.toLocaleString()} unité{totalDefender > 1 ? 's' : ''} défensive{totalDefender > 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>

          {/* Actions + résultat */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <Button onClick={runSim} disabled={running || totalAttacker === 0}>
                <Swords className="h-4 w-4 mr-1.5" />
                {running ? 'Simulation…' : `Simuler (${PRESET_RUNS} combats)`}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={running}>
                <RotateCcw className="h-4 w-4 mr-1.5" /> Réinitialiser
              </Button>
            </div>

            {result && <ResultPanel result={result} catalog={codex?.units ?? []} />}
          </div>
        </div>
      ) : (
        <CodexPanel units={codex?.units ?? []} catName={catName} />
      )}
    </div>
  );
}

// ── Panneau de résultats ──

function ResultPanel({
  result,
  catalog,
}: {
  result: NonNullable<Awaited<ReturnType<ReturnType<typeof trpc.useUtils>['combat']['simulate']['fetch']>>>;
  catalog: CodexUnit[];
}) {
  const nameOf = useMemo(() => {
    const map = new Map(catalog.map((u) => [u.id, u.name]));
    return (id: string) => map.get(id) ?? id;
  }, [catalog]);

  const verdict =
    result.winRate >= 0.85
      ? { label: 'Victoire très probable', tone: 'text-emerald-400' }
      : result.winRate >= 0.5
        ? { label: 'Victoire probable', tone: 'text-emerald-300' }
        : result.winRate >= 0.2
          ? { label: 'Issue incertaine', tone: 'text-amber-300' }
          : { label: 'Défaite probable', tone: 'text-rose-400' };

  const atkLosses = Object.entries(result.attacker.avgLosses).filter(([, v]) => v > 0.05);
  const defLosses = Object.entries(result.defender.avgLosses).filter(([, v]) => v > 0.05);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className={cn('text-base font-semibold', verdict.tone)}>{verdict.label}</div>
          <div className="text-xs text-muted-foreground">
            moyenne sur {result.runs} combats · {result.avgRounds.toFixed(1)} rounds
          </div>
        </div>

        {/* Barre d'issues */}
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-emerald-500" style={{ width: pct(result.winRate) }} title={`Victoire ${pct(result.winRate)}`} />
            <div className="bg-amber-500" style={{ width: pct(result.drawRate) }} title={`Nul ${pct(result.drawRate)}`} />
            <div className="bg-rose-500" style={{ width: pct(result.lossRate) }} title={`Défaite ${pct(result.lossRate)}`} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span className="text-emerald-400">Victoire {pct(result.winRate)}</span>
            <span className="text-amber-400">Nul {pct(result.drawRate)}</span>
            <span className="text-rose-400">Défaite {pct(result.lossRate)}</span>
          </div>
        </div>

        {!result.hasDefenders && (
          <p className="text-xs text-muted-foreground italic">
            Aucune défense adverse — victoire automatique sans perte.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Pertes attaquant */}
          <div>
            <div className="text-xs font-semibold text-foreground mb-1.5">Tes pertes moyennes</div>
            {atkLosses.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune perte significative.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {atkLosses.map(([id, v]) => (
                  <li key={id} className="flex justify-between">
                    <span className="text-muted-foreground">{nameOf(id)}</span>
                    <span className="text-rose-300">−{Math.round(v).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
            {result.attacker.flagshipLossChance > 0 && (
              <p className="mt-1 text-xs text-amber-300">
                Vaisseau amiral neutralisé : {pct(result.attacker.flagshipLossChance)} des combats
              </p>
            )}
          </div>

          {/* Pertes défenseur */}
          <div>
            <div className="text-xs font-semibold text-foreground mb-1.5">Pertes adverses moyennes</div>
            {defLosses.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {defLosses.map(([id, v]) => (
                  <li key={id} className="flex justify-between">
                    <span className="text-muted-foreground">{nameOf(id)}</span>
                    <span className="text-emerald-300">−{Math.round(v).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/50 pt-2 text-xs text-muted-foreground">
          <span>Débris générés : {result.avgDebris.minerai.toLocaleString()} M · {result.avgDebris.silicium.toLocaleString()} S</span>
          <span>
            Tes bonus : armes ×{result.multipliers.attacker.weapons.toFixed(2)} · bouclier ×
            {result.multipliers.attacker.shielding.toFixed(2)} · blindage ×{result.multipliers.attacker.armor.toFixed(2)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Codex des contres ──

function CodexPanel({ units, catName }: { units: CodexUnit[]; catName: (id: string) => string }) {
  const groups = useMemo(() => {
    const order = ['light', 'medium', 'heavy', 'defense'];
    const byCat = new Map<string, CodexUnit[]>();
    for (const u of units) {
      const key = u.kind === 'defense' ? 'defense' : u.categoryId;
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(u);
    }
    return order.filter((k) => byCat.has(k)).map((k) => ({ key: k, units: byCat.get(k)! }));
  }, [units]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Chaque batterie vise une catégorie. <span className="text-foreground">Rafale</span> = tirs bonus
        contre sa cible ; <span className="text-foreground">Enchaînement</span> = un tir bonus à chaque
        unité détruite (anti-essaim).
      </p>
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {g.key === 'defense' ? 'Défenses' : catName(g.key)}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.units.map((u) => (
              <Card key={u.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{u.name}</span>
                    <Badge variant="secondary">{catName(u.categoryId)}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Bouclier {u.shield} · Coque {u.hull} · Blindage {u.armor}
                  </div>
                  <div className="mt-2 space-y-1">
                    {u.weapons.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">Sans armement</span>
                    ) : (
                      u.weapons.map((w, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-foreground">
                            {w.damage} dmg ×{w.shots}
                          </span>
                          <span className="text-muted-foreground">→ {catName(w.targetCategory)}</span>
                          {w.rafale && (
                            <span className="inline-flex items-center gap-0.5 text-amber-300">
                              <Zap className="h-3 w-3" /> Rafale {w.rafale.count} ({catName(w.rafale.category)})
                            </span>
                          )}
                          {w.chainKill && (
                            <span className="inline-flex items-center gap-0.5 text-sky-300">
                              <Link2 className="h-3 w-3" /> Enchaînement
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
