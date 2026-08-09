import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Détecteur D3 — cohérence de la navigation.
 *
 * Quatre sources décrivent où un joueur peut aller, sans qu'aucune ne dérive
 * des autres : la barre latérale (desktop), la barre d'onglets et son
 * bottom-sheet (mobile), les règles de visibilité progressive, et le routeur —
 * seul ce dernier fait autorité.
 *
 * Quand un écran est ajouté ou déplacé, il faut penser aux quatre. Le commit
 * 6d8ede9a ne l'a pas fait : « Politiques d'empire » a été livré, routé, visible
 * sur desktop, et **absent de la navigation mobile**. Personne ne s'en est
 * aperçu. Le rework va ajouter des écrans ; ce test évite de refaire ça.
 *
 * ## Pourquoi une analyse statique
 *
 * Importer `Sidebar.tsx` exécuterait toute sa chaîne d'imports (React, icônes,
 * stores) et exigerait un environnement DOM plus un alias `@/` dans la config
 * vitest. On lit le texte des fichiers — même approche que les détecteurs D1 et
 * D2, pour la même raison.
 */

const here = dirname(fileURLToPath(import.meta.url));
const R = (p: string) => resolve(here, p);
const ROUTER = R('../../../router.tsx');
const SIDEBAR = R('../Sidebar.tsx');
const BOTTOM_BAR = R('../BottomTabBar.tsx');
const VISIBILITY = R('../../../../../../packages/game-engine/src/sidebar-visibility.ts');

const lire = (p: string) => readFileSync(p, 'utf8');
const estStatique = (p: string) => !p.includes(':');

/** Chemins déclarés dans le routeur, normalisés en absolu. */
function cheminsDuRouteur(): Set<string> {
  const chemins = new Set<string>(['/']); // la route `index: true` correspond à '/'
  for (const m of lire(ROUTER).matchAll(/path:\s*'([^']*)'/g)) {
    const p = m[1];
    chemins.add(p.startsWith('/') ? p : `/${p}`);
  }
  return chemins;
}

/** Chemins cités dans un fichier de navigation, via `path: '/x'`. */
function cheminsDeclares(fichier: string): string[] {
  return [...lire(fichier).matchAll(/path:\s*'([^']*)'/g)]
    .map((m) => m[1])
    .filter(estStatique);
}

/** Chemins des groupes d'onglets mobiles : `groupe: ['/a', '/b']`. */
function cheminsDesOnglets(): string[] {
  const src = lire(BOTTOM_BAR);
  const bloc = src.match(/const TAB_GROUPS = \{([\s\S]*?)\n\};/);
  if (!bloc) return [];
  return [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter(estStatique);
}

/** Clés des règles de visibilité progressive. */
function cheminsAvecRegle(): string[] {
  const src = lire(VISIBILITY);
  // Le bloc se ferme par `} as const satisfies …`, pas par `};`.
  const bloc = src.match(/SIDEBAR_VISIBILITY_RULES = \{([\s\S]*?)\n\}/);
  if (!bloc) return [];
  return [...bloc[1].matchAll(/'([^']+)':/g)].map((m) => m[1]);
}

describe('D3 — cohérence de la navigation', () => {
  const routes = cheminsDuRouteur();
  const sidebar = cheminsDeclares(SIDEBAR);
  const onglets = cheminsDesOnglets();
  const feuilles = cheminsDeclares(BOTTOM_BAR);
  const mobile = new Set([...onglets, ...feuilles]);
  const regles = cheminsAvecRegle();

  it('le détecteur voit bien les quatre sources', () => {
    // Garde-fou : si un motif casse, échouer ici plutôt que de laisser le test
    // passer sur des listes vides.
    expect(routes.size).toBeGreaterThan(30);
    expect(sidebar.length).toBeGreaterThan(8);
    expect(onglets.length).toBeGreaterThan(8);
    expect(feuilles.length).toBeGreaterThan(8);
    expect(regles.length).toBeGreaterThan(5);
  });

  it('tout chemin de la barre latérale existe dans le routeur', () => {
    const inconnus = [...new Set(sidebar)].filter((p) => !routes.has(p)).sort();
    expect(
      inconnus,
      `\nCes entrées de la barre latérale pointent vers une route inexistante :\n` +
        inconnus.map((p) => `  - ${p}`).join('\n'),
    ).toEqual([]);
  });

  it('tout chemin de la navigation mobile existe dans le routeur', () => {
    const inconnus = [...mobile].filter((p) => !routes.has(p)).sort();
    expect(
      inconnus,
      `\nCes entrées de la navigation mobile pointent vers une route inexistante :\n` +
        inconnus.map((p) => `  - ${p}`).join('\n'),
    ).toEqual([]);
  });

  it('tout écran de la barre latérale est atteignable sur mobile', () => {
    // C'est LE cas qui s'est produit avec « Politiques d'empire ».
    const absents = [...new Set(sidebar)].filter((p) => !mobile.has(p)).sort();
    expect(
      absents,
      `\nCes écrans sont dans la barre latérale desktop mais introuvables dans la\n` +
        `navigation mobile — un joueur sur téléphone ne peut pas y accéder :\n` +
        absents.map((p) => `  - ${p}`).join('\n') +
        `\n\nAjoute-les à TAB_GROUPS et SHEET_ITEMS (BottomTabBar.tsx), ou retire-les\n` +
        `de la barre latérale si l'écran n'a plus lieu d'être.\n`,
    ).toEqual([]);
  });

  it('toute règle de visibilité porte sur une route réelle', () => {
    const orphelines = regles.filter((p) => !routes.has(p)).sort();
    expect(
      orphelines,
      `\nCes règles de visibilité progressive ciblent une route inexistante — elles\n` +
        `ne s'appliqueront jamais :\n` +
        orphelines.map((p) => `  - ${p}`).join('\n'),
    ).toEqual([]);
  });
});
