import { Sparkles } from 'lucide-react';

const STAT_LABELS: Record<string, string> = {
  production_minerai: 'Production minerai',
  production_silicium: 'Production silicium',
  production_hydrogene: 'Production hydrogène',
  energy_production: 'Production énergie',
  energy_consumption: 'Consommation énergie',
  storage_minerai: 'Stockage minerai',
  storage_silicium: 'Stockage silicium',
  storage_hydrogene: 'Stockage hydrogène',
  // Temps & construction (libellés alignés sur BONUS_DEFINITIONS)
  building_time: 'Temps de construction',
  research_time: 'Temps de recherche',
  ship_build_time: 'Temps de construction des vaisseaux',
  defense_build_time: 'Temps de construction des défenses',
  hull_combat_build_time_reduction: 'Construction des coques de combat',
  flagship_repair_time: 'Réparation du vaisseau amiral',
  // Combat / flotte
  weapons: 'Dégâts des armes',
  shielding: 'Puissance des boucliers',
  armor: 'Coque et blindage',
  ship_speed: 'Vitesse des vaisseaux',
};

const SOURCE_LABELS: Record<string, string> = {
  type_planete: 'type de planète',
  biomes: 'biomes',
  vocation: 'vocation',
  recherche: 'recherche',
  talents: 'talents',
  gouvernance: 'gouvernance',
};

/** Stats où un modificateur négatif est un avantage (consommer moins). */
const NEGATIVE_IS_GOOD = new Set(['energy_consumption']);

export interface BonusBreakdownEntry {
  source: string;
  stat: string;
  modifier: number;
}

/**
 * Bannière « Bonus actifs sur la planète » — affiche le détail exact de ce
 * que le serveur applique aux taux (`rates.bonuses`). Source de vérité
 * unique : AUCUN cumul n'est recalculé côté front (c'est comme ça que la
 * vocation avait été oubliée de l'affichage).
 */
export function OverviewBonuses({ bonuses }: { bonuses?: BonusBreakdownEntry[] }) {
  const totals = new Map<string, { total: number; parts: string[] }>();
  for (const b of bonuses ?? []) {
    const cur = totals.get(b.stat) ?? { total: 0, parts: [] };
    cur.total += b.modifier;
    cur.parts.push(`${SOURCE_LABELS[b.source] ?? b.source} ${b.modifier > 0 ? '+' : ''}${Math.round(b.modifier * 100)} %`);
    totals.set(b.stat, cur);
  }

  const entries = [...totals.entries()].filter(([, v]) => Math.abs(v.total) >= 0.005);
  if (entries.length === 0) return null;

  // Sort: prod first (the most impactful), then energy, then storage.
  const order = Object.keys(STAT_LABELS);
  entries.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs uppercase text-primary/70 font-semibold tracking-wider mb-2">
        <Sparkles className="h-3 w-3" />
        Bonus actifs sur la planète
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([stat, { total, parts }]) => {
          const good = NEGATIVE_IS_GOOD.has(stat) ? total < 0 : total > 0;
          return (
            <span
              key={stat}
              title={parts.join(' · ')}
              className={`text-sm font-semibold tabular-nums ${good ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {total > 0 ? '+' : ''}
              {Math.round(total * 100)}% <span className="text-foreground/70 font-normal">{STAT_LABELS[stat] ?? stat}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
