import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Détecteur D2 — clé de bonus lue sans producteur.
 *
 * Le jeu applique ses bonus via un dictionnaire `Record<string, number>` :
 * quelqu'un écrit `ctx['mining_speed'] = 0.45`, quelqu'un d'autre lit
 * `ctx['mining_speed'] ?? 0`. Rien ne relie les deux. Quand un système est
 * retiré, son producteur disparaît et le lecteur reste — il retombe alors
 * silencieusement sur `?? 0`, c'est-à-dire sur un levier neutre.
 *
 * **C'est le mécanisme exact par lequel ce projet a perdu des capacités sans
 * s'en apercevoir** : talents, anomalies, expéditions, `flagship.rename` et les
 * préférences push sont tous morts comme ça. Un rework qui ajoute des dizaines
 * de leviers sans ce détecteur produira la même chose.
 *
 * Le test croise les clés LUES dans le code avec les clés PRODUITES par le seed
 * (bonus de recherche/bâtiment, effets de biome, bonus passifs de coque) et par
 * `computeTalentContext`. Analyse statique : pas de base requise, tourne en CI.
 */

const here = dirname(fileURLToPath(import.meta.url));
const R = (p: string) => resolve(here, p);

const SOURCES_LECTURE = [
  R('../../../modules'),
  R('../../../workers'),
  R('../../../cron'),
];
const SEED = R('../../../../../../packages/db/src/game-config-data.ts');
const SEED_MAIN = R('../../../../../../packages/db/src/seed-game-config.ts');
const TALENT_SERVICE = R('../../flagship/talent.service.ts');

/**
 * Leviers connus sans producteur, **figés** pour que le test passe au vert
 * aujourd'hui tout en les gardant visibles.
 *
 * Chacun est une décision d'équilibrage en suspens, pas un bug à corriger
 * mécaniquement : soit on produit la clé, soit on retire la lecture. Le
 * rework tranchera. **Ne jamais ajouter une entrée ici pour faire taire le
 * test** — c'est précisément comme ça que la dette est née.
 */
const LEVIERS_MORTS_CONNUS = new Set([
  'fleet_cargo',
  'fleet_fuel',
  'fleet_speed',
  'market_fee',
  'pve_loot',
  // Lus dans shipyard.service via une clé construite (ternaire sur buildCategory),
  // donc invisibles à un grep naïf. Le producteur le plus proche est
  // `ship_build_time`, avec une catégorie — pas ces deux clés-là.
  'military_build_time',
  'industrial_build_time',
]);

function listerFichiersTs(racine: string): string[] {
  const out: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = resolve(d, e);
      if (statSync(p).isDirectory()) {
        if (e !== 'node_modules' && e !== 'dist') parcourir(p);
      } else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) {
        out.push(p);
      }
    }
  };
  parcourir(racine);
  return out;
}

/** Clés lues depuis un contexte de bonus : `xxxCtx['cle']`, `talentBonuses?.['cle']`. */
function clesLues(): Map<string, string[]> {
  const lues = new Map<string, string[]>();
  const motif = /(?:talentCtx|talentBonuses|bonusCtx|defenderBonusCtx|ctx)\??\.?\[\s*'([a-z_]+)'\s*\]/g;
  for (const racine of SOURCES_LECTURE) {
    for (const f of listerFichiersTs(racine)) {
      // On retire commentaires de ligne et de bloc AVANT de chercher : sinon un
      // commentaire qui documente un levier retire (« pour le reinstaurer, lire
      // ctx['x'] ») serait compte comme une lecture. Le detecteur s'est fait
      // prendre a son propre piege sur `pillage_protection`.
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const m of src.matchAll(motif)) {
        const cle = m[1];
        if (!lues.has(cle)) lues.set(cle, []);
        lues.get(cle)!.push(f.split('/apps/api/src/')[1] ?? f);
      }
    }
  }
  return lues;
}

/** Clés produites : seed (bonus, biomes, coques) + computeTalentContext. */
function clesProduites(): Set<string> {
  const produites = new Set<string>();

  for (const fichier of [SEED, SEED_MAIN]) {
    const src = readFileSync(fichier, 'utf8');
    // bonus_definitions et effets de biome declarent tous deux `stat: '...'`
    for (const m of src.matchAll(/\bstat:\s*'([a-z_]+)'/g)) produites.add(m[1]);
  }

  // Bonus passifs de coque : talent.service les remappe (cf. plus bas).
  const seedMain = readFileSync(SEED_MAIN, 'utf8');
  for (const m of seedMain.matchAll(/passiveBonuses:\s*\{([^}]*)\}/g)) {
    for (const k of m[1].matchAll(/([a-z_]+)\s*:/g)) {
      const brut = k[1];
      if (brut === 'repair_time_reduction') produites.add('flagship_repair_time');
      else if (brut === 'mining_speed_bonus') produites.add('mining_speed');
      else if (brut === 'prospection_speed_bonus') produites.add('prospection_speed');
      else if (brut.endsWith('_time_reduction')) produites.add(`hull_${brut}`);
    }
  }

  // Écritures littérales dans computeTalentContext.
  const talent = readFileSync(TALENT_SERVICE, 'utf8');
  for (const m of talent.matchAll(/ctx\[\s*'([a-z_]+)'\s*\]\s*=/g)) produites.add(m[1]);

  return produites;
}

describe('D2 — leviers de bonus lus sans producteur', () => {
  const lues = clesLues();
  const produites = clesProduites();

  it('le détecteur voit bien des lectures et des producteurs', () => {
    // Garde-fou : si un motif casse, on veut échouer ici plutôt que de voir le
    // test passer sur des ensembles vides.
    expect(lues.size).toBeGreaterThan(8);
    expect(produites.size).toBeGreaterThan(10);
    expect(produites.has('production_minerai')).toBe(true);
    expect(produites.has('flagship_repair_time')).toBe(true);
  });

  it('aucun levier mort non déclaré', () => {
    const orphelines = [...lues.keys()]
      .filter((k) => !produites.has(k))
      .filter((k) => !LEVIERS_MORTS_CONNUS.has(k))
      .sort();

    expect(
      orphelines,
      orphelines.length
        ? `\nCes clés de bonus sont LUES mais personne ne les produit — elles valent ` +
          `donc toujours 0, en silence :\n` +
          orphelines.map((k) => `  - ${k}  (lu dans ${lues.get(k)!.join(', ')})`).join('\n') +
          `\n\nSoit tu produis la clé (bonus_definitions, effet de biome, bonus passif de ` +
          `coque, computeTalentContext), soit tu retires la lecture.\n` +
          `Ne l'ajoute à LEVIERS_MORTS_CONNUS que si c'est une décision assumée et datée.\n`
        : '',
    ).toEqual([]);
  });

  it('les leviers morts déclarés le sont toujours réellement', () => {
    // Si l'un d'eux acquiert un producteur, il faut le sortir de la liste —
    // sinon la liste devient un mensonge qu'on trimballe.
    const ressuscites = [...LEVIERS_MORTS_CONNUS].filter((k) => produites.has(k));
    expect(
      ressuscites,
      `Ces clés ont désormais un producteur : retire-les de LEVIERS_MORTS_CONNUS.`,
    ).toEqual([]);
  });
});
