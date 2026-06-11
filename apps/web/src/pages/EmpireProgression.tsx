import { useMemo } from 'react';
import { Crown, Check, Lock, Hammer, FlaskConical, Target, Swords, Globe2 } from 'lucide-react';
import { trpc } from '@/trpc';
import { useGameConfig } from '@/hooks/useGameConfig';
import {
  buildEmpireLevelConfig,
  empireXpRequiredForLevel,
  empireGovernanceCapacity,
  empireMissionLevel,
} from '@exilium/game-engine';
import { PageHeader } from '@/components/common/PageHeader';
import { cn } from '@/lib/utils';

interface Milestone {
  level: number;
  gains: string[];
  xpRequired: number;
}

/**
 * Progression d'empire — où j'en suis, ce que mes niveaux m'ont donné, ce
 * que les prochains donneront, et comment gagner de l'XP. Tout est calculé
 * avec les formules de l'engine + la config univers : la page dit la vérité
 * du moteur (aucun barème en dur).
 */
export default function EmpireProgression() {
  const { data: progression } = trpc.empireProgression.get.useQuery();
  const { data: gameConfig } = useGameConfig();

  const universe = (gameConfig?.universe ?? {}) as Record<string, unknown>;
  const cfg = useMemo(() => buildEmpireLevelConfig(universe), [universe]);

  const xpSources = [
    { icon: Hammer, label: 'Construire des bâtiments', value: `${Number(universe.empire_xp_per_building_level) || 2} XP × niveau construit` },
    { icon: FlaskConical, label: 'Terminer des recherches', value: `${Number(universe.empire_xp_per_research_level) || 5} XP × niveau` },
    { icon: Target, label: 'Missions PvE', value: `${Number(universe.empire_xp_pve_victory) || 15} XP par victoire` },
    { icon: Swords, label: 'Victoires PvP (en attaque)', value: `${Number(universe.empire_xp_pvp_victory) || 40} XP par victoire` },
    { icon: Globe2, label: 'Fonder une colonie', value: `${Number(universe.empire_xp_colonization) || 150} XP` },
  ];

  const unlocks = useMemo(() => ([
    { level: Number(universe.vocation_unlock_level) || 5, label: 'Vocations des mondes', desc: 'spécialiser chaque colonie (minière, forge…)' },
    { level: Number(universe.governor_unlock_level) || 8, label: 'Gouverneurs', desc: 'déléguer la construction par directive' },
  ]), [universe]);

  const data = useMemo(() => {
    if (!progression) return null;
    const { level, xp, missionLevel } = progression;
    // Niveau de mission de base (le serveur ne renvoie que la valeur courante).
    const missionDefault = missionLevel - Math.floor(Math.max(0, level - 1) / cfg.missionLevelsPerBonus);

    const gainsAt = (l: number): string[] => {
      const g: string[] = [];
      if (empireGovernanceCapacity(l, cfg) > empireGovernanceCapacity(l - 1, cfg)) {
        g.push('+1 capacité de gouvernance (une colonie de plus sans malus)');
      }
      if (empireMissionLevel(l, missionDefault, cfg) > empireMissionLevel(l - 1, missionDefault, cfg)) {
        g.push('+1 niveau des missions PvE (plus riches, plus dures)');
      }
      for (const u of unlocks) {
        if (u.level === l) g.push(`Débloque : ${u.label} — ${u.desc}`);
      }
      return g;
    };

    const next: Milestone[] = [];
    for (let l = level + 1; l <= cfg.maxLevel && next.length < 8; l++) {
      const gains = gainsAt(l);
      if (gains.length > 0) next.push({ level: l, gains, xpRequired: empireXpRequiredForLevel(l, cfg) });
    }

    const acquired = [
      `Capacité de gouvernance : ${empireGovernanceCapacity(level, cfg)} colonies`,
      `Niveau des missions PvE : ${missionLevel}`,
      ...unlocks.filter((u) => level >= u.level).map((u) => `${u.label} (niveau ${u.level})`),
    ];
    const lockedUnlocks = unlocks.filter((u) => level < u.level);

    return { gainsAt, next, acquired, lockedUnlocks, missionDefault };
  }, [progression, cfg, unlocks]);

  if (!progression || !data) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <PageHeader title="Progression d'empire" />
        <div className="glass-card h-40 animate-pulse" />
      </div>
    );
  }

  const { level, xp, currentLevelXp, nextLevelXp, maxLevel } = progression;
  const levelPct = nextLevelXp != null
    ? Math.min(100, Math.round(((xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100))
    : 100;

  return (
    <div className="space-y-4 p-4 lg:space-y-6 lg:p-6">
      <PageHeader title="Progression d'empire" />

      {/* Où j'en suis */}
      <section className="glass-card p-4 lg:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-energy/15">
            <Crown className="h-6 w-6 text-energy" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-bold text-foreground">Niveau {level}</h2>
              <span className="text-xs text-muted-foreground">max {maxLevel}</span>
            </div>
            {nextLevelXp != null ? (
              <p className="text-sm text-muted-foreground tabular-nums">
                {(xp - currentLevelXp).toLocaleString('fr-FR')} / {(nextLevelXp - currentLevelXp).toLocaleString('fr-FR')} XP —{' '}
                encore {(nextLevelXp - xp).toLocaleString('fr-FR')} XP avant le niveau {level + 1}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Niveau maximum atteint</p>
            )}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-2 rounded-full bg-energy/80 transition-[width]" style={{ width: `${levelPct}%` }} />
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground tabular-nums">
            XP totale<br /><span className="text-sm font-semibold text-foreground">{xp.toLocaleString('fr-FR')}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Ce que mes niveaux m'ont donné */}
        <section className="glass-card p-4 lg:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Check className="h-4 w-4 text-emerald-400" /> Acquis avec vos {level} niveaux
          </h3>
          <ul className="space-y-2">
            {data.acquired.map((a) => (
              <li key={a} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                {a}
              </li>
            ))}
            {data.lockedUnlocks.map((u) => (
              <li key={u.label} className="flex items-start gap-2 text-sm text-muted-foreground-soft">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {u.label} — au niveau {u.level}
              </li>
            ))}
          </ul>
        </section>

        {/* Comment gagner de l'XP */}
        <section className="glass-card p-4 lg:p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gagner de l'XP</h3>
          <ul className="space-y-2">
            {xpSources.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <s.icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-foreground">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">{s.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground-soft">
            Les unités produites au chantier ne rapportent pas d'XP.
          </p>
        </section>
      </div>

      {/* Les prochains paliers */}
      <section className="glass-card p-4 lg:p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prochains paliers</h3>
        <ol className="space-y-1.5">
          {data.next.map((m, i) => (
            <li
              key={m.level}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2',
                i === 0 ? 'border-primary/30 bg-primary/5' : 'border-border/50',
              )}
            >
              <span className={cn(
                'flex h-7 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums',
                i === 0 ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                {m.level}
              </span>
              <div className="min-w-0 flex-1 text-sm text-foreground">
                {m.gains.map((g) => <div key={g}>{g}</div>)}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                encore {(m.xpRequired - xp).toLocaleString('fr-FR')} XP
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground-soft">
          Puis +1 capacité de gouvernance tous les {cfg.capacityLevelsPerColony} niveaux et +1 niveau de missions tous les {cfg.missionLevelsPerBonus} niveaux, jusqu'au niveau {maxLevel}.
        </p>
      </section>
    </div>
  );
}
