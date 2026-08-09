import { describe, it, expect } from 'vitest';
import {
  buildPremierCycleConfig,
  cycleDeadlines,
  premierPhase,
  bonusActif,
  progressionSiege,
  garrisonSize,
  appliquerPertes,
  DEFAULT_PREMIER_CYCLE,
  type PremierSystemLike,
} from './premier-cycle.js';

const T0 = new Date('2026-09-01T12:00:00.000Z');
const plusHeures = (h: number) => new Date(T0.getTime() + h * 3600 * 1000);

/** Un système tenu, garnison intacte. */
function tenu(): PremierSystemLike {
  return {
    garrison: { interceptor: 40, cruiser: 10, battlecruiser: 4 },
    garrisonRemaining: { interceptor: 40, cruiser: 10, battlecruiser: 4 },
    liberatedAt: null,
    windowEndsAt: null,
    returnsAt: null,
  };
}

/** Un système repris à T0, avec les échéances par défaut. */
function libere(): PremierSystemLike {
  const d = cycleDeadlines(T0, DEFAULT_PREMIER_CYCLE);
  return {
    garrison: { interceptor: 40, cruiser: 10, battlecruiser: 4 },
    garrisonRemaining: {},
    liberatedAt: d.liberatedAt,
    windowEndsAt: d.windowEndsAt,
    returnsAt: d.returnsAt,
  };
}

describe('buildPremierCycleConfig', () => {
  it('retombe sur les valeurs par defaut quand les cles manquent', () => {
    expect(buildPremierCycleConfig({})).toEqual(DEFAULT_PREMIER_CYCLE);
  });

  it('rejette les valeurs absurdes plutot que de les propager', () => {
    // Une fenetre nulle ou negative fermerait le bonus avant de l'ouvrir.
    expect(buildPremierCycleConfig({ premier_window_hours: 0 }).windowHours)
      .toBe(DEFAULT_PREMIER_CYCLE.windowHours);
    expect(buildPremierCycleConfig({ premier_return_hours: -5 }).returnHours)
      .toBe(DEFAULT_PREMIER_CYCLE.returnHours);
    expect(buildPremierCycleConfig({ premier_window_hours: 'beaucoup' }).windowHours)
      .toBe(DEFAULT_PREMIER_CYCLE.windowHours);
  });

  it('lit les valeurs fournies', () => {
    expect(buildPremierCycleConfig({ premier_window_hours: 12, premier_return_hours: 72 }))
      .toEqual({ windowHours: 12, returnHours: 72 });
  });
});

describe('cycleDeadlines', () => {
  it('compte les deux delais depuis la liberation, pas en cascade', () => {
    const d = cycleDeadlines(T0, { windowHours: 48, returnHours: 168 });
    expect(d.windowEndsAt).toEqual(plusHeures(48));
    expect(d.returnsAt).toEqual(plusHeures(168));
  });

  it('accepte un retour plus rapide que la fenetre — reglage agressif, pas incoherence', () => {
    const d = cycleDeadlines(T0, { windowHours: 48, returnHours: 24 });
    expect(d.returnsAt.getTime()).toBeLessThan(d.windowEndsAt.getTime());
  });
});

describe('premierPhase — le cycle complet', () => {
  it('garnison intacte : tenu', () => {
    expect(premierPhase(tenu(), T0)).toBe('held');
  });

  it('garnison entamee : conteste — le siege est visible avant d aboutir', () => {
    const s = tenu();
    s.garrisonRemaining = { interceptor: 12, cruiser: 10, battlecruiser: 4 };
    expect(premierPhase(s, T0)).toBe('contested');
  });

  it('garnison a zero : libere, et le bonus court', () => {
    expect(premierPhase(libere(), plusHeures(1))).toBe('liberated_active');
    expect(bonusActif(libere(), plusHeures(1))).toBe(true);
  });

  it('apres la fenetre : encore a nous, mais ne rapporte plus', () => {
    expect(premierPhase(libere(), plusHeures(49))).toBe('liberated_spent');
    expect(bonusActif(libere(), plusHeures(49))).toBe(false);
  });

  it('apres le retour : de nouveau tenu — la carte ne se finit jamais', () => {
    expect(premierPhase(libere(), plusHeures(169))).toBe('held');
  });

  it('dit la verite du moment sans attendre le cron de retour', () => {
    // La base porte encore `liberated` et une garnison vide, mais l'echeance
    // est passee : l'affichage doit deja montrer un systeme tenu, sinon le
    // joueur voit un bonus qui n'existe plus jusqu'au prochain passage du cron.
    const s = libere();
    expect(premierPhase(s, plusHeures(200))).toBe('held');
  });

  it('une garnison vide sans liberatedAt n est pas une liberation', () => {
    // Cas limite : un systeme mal seede, sans garnison. Il ne doit pas passer
    // pour repris par accident.
    const s: PremierSystemLike = {
      garrison: {}, garrisonRemaining: {},
      liberatedAt: null, windowEndsAt: null, returnsAt: null,
    };
    expect(premierPhase(s, T0)).toBe('held');
  });
});

describe('progressionSiege — la barre que le groupe regarde', () => {
  it('vaut 0 sur une garnison intacte et 1 sur un systeme repris', () => {
    expect(progressionSiege(tenu())).toBe(0);
    expect(progressionSiege(libere())).toBe(1);
  });

  it('cumule les assauts successifs', () => {
    const s = tenu();
    const plein = garrisonSize(s.garrison); // 54
    s.garrisonRemaining = appliquerPertes(s.garrisonRemaining, { interceptor: 27 });
    expect(progressionSiege(s)).toBeCloseTo(27 / plein, 10);
    s.garrisonRemaining = appliquerPertes(s.garrisonRemaining, { interceptor: 13, cruiser: 5 });
    expect(progressionSiege(s)).toBeCloseTo(45 / plein, 10);
  });
});

describe('appliquerPertes', () => {
  it('ne descend jamais sous zero et supprime les entrees vidées', () => {
    const reste = appliquerPertes({ interceptor: 5, cruiser: 2 }, { interceptor: 99, cruiser: 1 });
    // Sans la suppression, `interceptor: 0` trainerait et garrisonSize resterait
    // coherent — mais toute lecture naive de Object.keys croirait la garnison
    // encore composee de deux types de vaisseaux.
    expect(reste).toEqual({ cruiser: 1 });
  });

  it('ignore les pertes portant sur des unites absentes', () => {
    expect(appliquerPertes({ interceptor: 3 }, { battlecruiser: 10 })).toEqual({ interceptor: 3 });
  });

  it('vide completement la garnison quand tout tombe — la condition de victoire', () => {
    const reste = appliquerPertes({ interceptor: 4, cruiser: 1 }, { interceptor: 4, cruiser: 1 });
    expect(garrisonSize(reste)).toBe(0);
    expect(reste).toEqual({});
  });
});
