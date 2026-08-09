// packages/game-sim/src/reporter.golden.test.ts
import { describe, it, expect } from 'vitest';
import { runAll } from './run.js';
import { renderReport } from './reporter.js';

/**
 * Golden du rythme de progression.
 *
 * Ce fichier fige les **temps jusqu'au jalon** — la seule chose qui permette de
 * répondre à « de combien ce rééquilibrage a-t-il déplacé le mur ? ». Avant, il
 * ne vérifiait que le déterminisme et la présence de colonnes : doubler le coût
 * d'un bâtiment passait au vert.
 *
 * ## Discipline
 *
 * Quand une de ces valeurs bouge, **c'est le sujet de la discussion, pas un
 * détail à réaligner**. Ne relance `vitest -u` que si le commit explique quel
 * choix de design justifie le déplacement. Un golden qu'on met à jour
 * machinalement ne vaut rien.
 *
 * ## Pourquoi ces valeurs-là
 *
 * Elles ont été relevées le 2026-08-09, après avoir branché le simulateur sur la
 * vraie configuration du jeu. Il tournait auparavant sur les défauts en dur du
 * moteur — `timeDivisor` 2500 au lieu de 4500 — et construisait donc les
 * vaisseaux 1,8× trop vite : **il sous-estimait les murs qu'il a pour mission de
 * mesurer**.
 *
 * ## Déplacement du 2026-08-09 (acte 0) — `firstShip` uniquement
 *
 * Le simulateur ne recompose plus les primitives de production : il appelle
 * `calculateProductionRates` et l'assembleur de bonus partagé, comme le
 * serveur. Deux effets, tous deux dans les arrondis :
 *   - le moteur tronque l'énergie produite ET chaque poste de consommation
 *     séparément, là où le simulateur ne tronquait qu'à la fin ;
 *   - les bonus se cumulent additivement au lieu d'être multipliés (sans effet
 *     ici, la recherche étant la seule source du simulateur).
 *
 * Résultat : seul `firstShip` bouge, et **en sens opposé selon le profil** —
 * eco 3503,9 → 3596,0 h (+2,6 %), optimal 528,9 → 512,5 h (−3,1 %). Les six
 * autres jalons sont inchangés : ils tombent avant que le facteur d'énergie ne
 * pèse. Le signe opposé vient de là : les deux profils n'ont pas le même
 * rapport production/consommation au moment du premier vaisseau, donc la
 * troncature par poste ne les pénalise pas dans le même sens.
 *
 * ## Déplacement du 2026-08-09 (lot 1) — le mur d'hydrogène tombe
 *
 * Le prospecteur, vaisseau d'amorçage du minage, coûtait 375 d'hydrogène —
 * alors que c'est LUI qui en rapporte, et que la dotation de départ n'en donne
 * que 100. Il fallait donc faire tourner un synthétiseur d'hydrogène lent et
 * gourmand en énergie avant de pouvoir aller chercher de l'hydrogène. Un
 * verrou de ressource, pas une courbe : c'est pour ça qu'un kit de départ
 * n'aurait rien réglé, le mur serait revenu au deuxième vaisseau.
 *
 * L'hydrogène sort donc du coût du prospecteur et du satellite solaire (même
 * verrou : il produit l'énergie qui manque et coûtait ce qu'on ne peut pas
 * encore extraire).
 *
 * Mesure : **optimal 512,5 → 299,4 h, soit −41,6 %** — de trois semaines à
 * douze jours et demi avant le premier vaisseau. **eco reste à 3596,0 h,
 * inchangé** : à ce rythme-là le prospecteur arrive si tard que l'hydrogène
 * n'est plus la contrainte. Le mur ne mordait que le joueur qui pousse.
 *
 * Une première version compensait le retrait par +750 silicium sur le
 * prospecteur : elle dégradait l'eco à 3624,8 h sans rien apporter à
 * l'optimal (303 h contre 299,4). Écartée — elle ne faisait que punir le
 * joueur lent, ce que les principes du plan interdisent.
 *
 * ⚠️ Ce déplacement n'est PAS la mesure de la fuite de 19,4 %, contrairement à
 * ce que le plan d'implémentation annonçait. Le simulateur n'a jamais modélisé
 * le tick du worker, ni les biomes, ni les politiques : la fuite n'existait pas
 * chez lui, il n'y a donc rien à y voir se résorber. Ce qui est mesuré ici,
 * c'est uniquement l'alignement du simulateur sur l'arithmétique du serveur.
 */

/** Jalons figés, en heures. Ordre = ordre d'apparition dans la partie. */
const JALONS_ATTENDUS: Record<string, Record<string, number>> = {
  eco: {
    firstMine: 0.0,
    robotics: 51.9,
    firstResearchLab: 56.3,
    firstShipyard: 73.3,
    firstResearch: 73.3,
    energyTech: 73.3,
    firstShip: 3596.0,
  },
  optimal: {
    firstMine: 0.1,
    robotics: 139.3,
    firstResearchLab: 0.1,
    firstShipyard: 218.3,
    firstResearch: 26.7,
    energyTech: 26.7,
    firstShip: 299.4,
  },
};

const heures = (sec: number) => Math.round((sec / 3600) * 10) / 10;

/** Retire l'horodatage pour que le contrôle de déterminisme tienne. */
function normalize(report: string): string {
  return report.replace(/^- Date : .+$/m, '- Date : <normalized>');
}

describe('rapport multi-profils', () => {
  it('est déterministe et porte les deux profils', () => {
    const a = normalize(renderReport(runAll()));
    const b = normalize(renderReport(runAll()));
    expect(a).toBe(b);
    expect(a).toContain('optimal');
    expect(a).toContain("Temps jusqu'au jalon");
  });

  it.each(Object.keys(JALONS_ATTENDUS))(
    'profil %s : les temps jusqu\'au jalon sont inchangés',
    (profil) => {
      const run = runAll().find((r) => r.policy === profil);
      expect(run, `profil ${profil} absent du rapport`).toBeDefined();

      const obtenus: Record<string, number> = {};
      for (const m of run!.milestones) obtenus[m.id] = heures(m.timeSec);

      const attendus = JALONS_ATTENDUS[profil];
      const compares = Object.fromEntries(
        Object.keys(attendus).map((k) => [k, obtenus[k]]),
      );

      expect(
        compares,
        `\nLe rythme de progression a change sur le profil « ${profil} ».\n\n` +
          `Ce n'est pas un test a realigner : c'est le resultat d'un choix\n` +
          `d'equilibrage. Verifie que le deplacement est celui que tu voulais,\n` +
          `puis mets ces valeurs a jour EN L'EXPLIQUANT dans le message de commit.\n`,
      ).toEqual(attendus);
    },
  );

  it('le jalon le plus lointain reste sous surveillance', () => {
    // `firstShip` est le mur structurant du early-game : plus de 500 h en jeu
    // optimal, soit trois semaines avant le premier vaisseau. Si le rework le
    // fait tomber, tant mieux — mais qu'on le voie.
    const optimal = runAll().find((r) => r.policy === 'optimal')!;
    const firstShip = optimal.milestones.find((m) => m.id === 'firstShip');
    expect(firstShip, 'jalon firstShip introuvable').toBeDefined();
    expect(heures(firstShip!.timeSec)).toBe(JALONS_ATTENDUS.optimal.firstShip);
  });
});
