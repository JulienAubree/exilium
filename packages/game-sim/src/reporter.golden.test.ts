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
    firstShip: 3503.9,
  },
  optimal: {
    firstMine: 0.1,
    robotics: 139.3,
    firstResearchLab: 0.1,
    firstShipyard: 218.3,
    firstResearch: 26.7,
    energyTech: 26.7,
    firstShip: 528.9,
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
