import { describe, it, expect } from 'vitest';
import {
  tierWeightsForResearchLevel,
  pickTierForResearchLevel,
  generateMissionAttributes,
  computeHydrogenCost,
  addResourceToOutcomes,
  pickExplorationEvent,
  validateRequirements,
  applyHullDelta,
  type ExpeditionConfigKeys,
  type ExpeditionEventLite,
} from './exploration-mission.js';

const CONFIG: ExpeditionConfigKeys = {
  stepDurationEarlySeconds: 600,
  stepDurationMidSeconds: 1200,
  stepDurationDeepSeconds: 1800,
  hydrogenBaseCostEarly: 200,
  hydrogenBaseCostMid: 800,
  hydrogenBaseCostDeep: 2400,
  hydrogenMassFactor: 0.4,
  totalStepsEarlyMin: 1,
  totalStepsEarlyMax: 2,
  totalStepsMidMin: 2,
  totalStepsMidMax: 3,
  totalStepsDeepMin: 3,
  totalStepsDeepMax: 5,
};

function fixedRng(value: number): () => number {
  return () => value;
}

describe('tierWeightsForResearchLevel', () => {
  it('niveau 1-3 favorise early', () => {
    expect(tierWeightsForResearchLevel(1)).toEqual({ early: 0.8, mid: 0.2, deep: 0 });
    expect(tierWeightsForResearchLevel(3)).toEqual({ early: 0.8, mid: 0.2, deep: 0 });
  });
  it('niveau 4-7 mixe early et mid', () => {
    expect(tierWeightsForResearchLevel(4)).toEqual({ early: 0.4, mid: 0.5, deep: 0.1 });
    expect(tierWeightsForResearchLevel(7)).toEqual({ early: 0.4, mid: 0.5, deep: 0.1 });
  });
  it('niveau 8+ favorise mid et deep', () => {
    expect(tierWeightsForResearchLevel(8)).toEqual({ early: 0.1, mid: 0.5, deep: 0.4 });
    expect(tierWeightsForResearchLevel(20)).toEqual({ early: 0.1, mid: 0.5, deep: 0.4 });
  });
});

describe('pickTierForResearchLevel', () => {
  it('roll 0 → premier bucket non vide', () => {
    expect(pickTierForResearchLevel(1, fixedRng(0))).toBe('early');
    expect(pickTierForResearchLevel(8, fixedRng(0))).toBe('early'); // first bucket is 0.1
  });
  it('roll au-dessus de early → mid', () => {
    expect(pickTierForResearchLevel(1, fixedRng(0.85))).toBe('mid');
    expect(pickTierForResearchLevel(4, fixedRng(0.5))).toBe('mid');
  });
  it('roll proche de 1 → dernier bucket dispo', () => {
    expect(pickTierForResearchLevel(8, fixedRng(0.99))).toBe('deep');
    // À niveau 1, deep=0 → roll élevé tombe sur mid (pas de fallthrough vers deep)
    expect(pickTierForResearchLevel(1, fixedRng(0.99))).toBe('mid');
  });
});

describe('generateMissionAttributes', () => {
  it('early : 1-2 steps, 600s/step, 200 H2 base', () => {
    const attr = generateMissionAttributes('early', CONFIG, fixedRng(0));
    expect(attr.totalSteps).toBe(1);
    expect(attr.stepDurationSeconds).toBe(600);
    expect(attr.estimatedDurationSeconds).toBe(600);
    expect(attr.hydrogenBaseCost).toBe(200);
  });
  it('early avec rng au max → 2 steps', () => {
    const attr = generateMissionAttributes('early', CONFIG, fixedRng(0.99));
    expect(attr.totalSteps).toBe(2);
    expect(attr.estimatedDurationSeconds).toBe(1200);
  });
  it('mid : 2-3 steps, 1200s/step', () => {
    const attr = generateMissionAttributes('mid', CONFIG, fixedRng(0));
    expect(attr.totalSteps).toBe(2);
    expect(attr.stepDurationSeconds).toBe(1200);
  });
  it('deep : 3-5 steps, 1800s/step', () => {
    const attr = generateMissionAttributes('deep', CONFIG, fixedRng(0));
    expect(attr.totalSteps).toBe(3);
    expect(attr.stepDurationSeconds).toBe(1800);
  });
  it('deep rng max → 5 steps', () => {
    const attr = generateMissionAttributes('deep', CONFIG, fixedRng(0.99));
    expect(attr.totalSteps).toBe(5);
    expect(attr.estimatedDurationSeconds).toBe(9000);
  });
});

describe('computeHydrogenCost', () => {
  it('base seul', () => {
    expect(computeHydrogenCost(200, 0, 0.4)).toBe(200);
  });
  it('base + masse * facteur', () => {
    expect(computeHydrogenCost(800, 1000, 0.4)).toBe(1200);
  });
  it('arrondi vers le haut', () => {
    expect(computeHydrogenCost(200, 33, 0.4)).toBe(214); // 200 + 13.2 → ceil 214
  });
});

describe('addResourceToOutcomes', () => {
  const empty = { minerai: 0, silicium: 0, hydrogene: 0 };

  it('ajoute si capacité dispo', () => {
    const r = addResourceToOutcomes(empty, 1000, 'minerai', 300);
    expect(r.granted).toBe(300);
    expect(r.overflowed).toBe(0);
    expect(r.outcomes.minerai).toBe(300);
  });

  it('clamp si soute pleine', () => {
    const r = addResourceToOutcomes(
      { minerai: 800, silicium: 100, hydrogene: 50 },
      1000,
      'silicium',
      200,
    );
    expect(r.granted).toBe(50);
    expect(r.overflowed).toBe(150);
    expect(r.outcomes.silicium).toBe(150);
  });

  it('zéro si soute déjà pleine', () => {
    const r = addResourceToOutcomes(
      { minerai: 500, silicium: 500, hydrogene: 0 },
      1000,
      'hydrogene',
      100,
    );
    expect(r.granted).toBe(0);
    expect(r.overflowed).toBe(100);
  });

  it('montant <= 0 → no-op', () => {
    const r = addResourceToOutcomes(empty, 1000, 'minerai', 0);
    expect(r.granted).toBe(0);
    expect(r.overflowed).toBe(0);
    expect(r.outcomes).toBe(empty);
  });

  it('ne mute pas les outcomes en entrée', () => {
    const start = { minerai: 100, silicium: 0, hydrogene: 0 };
    addResourceToOutcomes(start, 1000, 'minerai', 200);
    expect(start.minerai).toBe(100);
  });
});

describe('pickExplorationEvent', () => {
  const events: ExpeditionEventLite[] = [
    { id: 'e1', tier: 'early', weight: 1, enabled: true },
    { id: 'e2', tier: 'early', weight: 3, enabled: true },
    { id: 'm1', tier: 'mid',   weight: 1, enabled: true },
    { id: 'd1', tier: 'deep',  weight: 1, enabled: false },
  ];

  it('filtre par tier', () => {
    const pick = pickExplorationEvent(events, 'mid', [], fixedRng(0));
    expect(pick?.id).toBe('m1');
  });

  it('exclut les déjà vus', () => {
    const pick = pickExplorationEvent(events, 'early', ['e1'], fixedRng(0));
    expect(pick?.id).toBe('e2');
  });

  it('si tout vu, autorise répétition', () => {
    const pick = pickExplorationEvent(events, 'early', ['e1', 'e2'], fixedRng(0));
    expect(['e1', 'e2']).toContain(pick?.id);
  });

  it('exclut les disabled', () => {
    const pick = pickExplorationEvent(events, 'deep', [], fixedRng(0));
    expect(pick).toBeNull();
  });

  it('respecte les weights', () => {
    // weight e1=1 + e2=3 = 4. roll = 0.5*4=2 → soustraction : 2-1 = 1 (>0), donc continue, 1-3=-2 (<0) → e2
    const pick = pickExplorationEvent(events, 'early', [], fixedRng(0.5));
    expect(pick?.id).toBe('e2');
  });
});

describe('validateRequirements', () => {
  const ctx = {
    userResearch: { recycling: 3, planetaryExploration: 2 },
    shipsAlive: { explorer: 2, recycler: 1, fighter: 0 },
    shipRoles: { explorer: 'exploration', recycler: 'recycler', fighter: 'attack' },
  };

  it('sans requirements → pass', () => {
    expect(validateRequirements(undefined, ctx).pass).toBe(true);
    expect(validateRequirements([], ctx).pass).toBe(true);
  });

  it('research pass', () => {
    const r = validateRequirements(
      [{ kind: 'research', researchId: 'recycling', minLevel: 3 }],
      ctx,
    );
    expect(r.pass).toBe(true);
  });

  it('research fail', () => {
    const r = validateRequirements(
      [{ kind: 'research', researchId: 'recycling', minLevel: 5 }],
      ctx,
    );
    expect(r.pass).toBe(false);
    expect(r.failures).toHaveLength(1);
  });

  it('shipRole pass', () => {
    const r = validateRequirements(
      [{ kind: 'shipRole', role: 'recycler', minCount: 1 }],
      ctx,
    );
    expect(r.pass).toBe(true);
  });

  it('shipRole compte les vivants uniquement', () => {
    // fighter alive=0 → ne compte pas, même si role='attack' demandé
    const r = validateRequirements(
      [{ kind: 'shipRole', role: 'attack', minCount: 1 }],
      ctx,
    );
    expect(r.pass).toBe(false);
  });

  it('shipId fail', () => {
    const r = validateRequirements(
      [{ kind: 'shipId', shipId: 'colonizer', minCount: 1 }],
      ctx,
    );
    expect(r.pass).toBe(false);
  });

  it('AND logique : tous doivent passer', () => {
    const r = validateRequirements(
      [
        { kind: 'research', researchId: 'recycling', minLevel: 3 },
        { kind: 'shipRole', role: 'recycler', minCount: 1 },
      ],
      ctx,
    );
    expect(r.pass).toBe(true);
  });

  it('AND logique : un fail → fail global, deux failures listées', () => {
    const r = validateRequirements(
      [
        { kind: 'research', researchId: 'recycling', minLevel: 5 },
        { kind: 'shipRole', role: 'attack', minCount: 1 },
      ],
      ctx,
    );
    expect(r.pass).toBe(false);
    expect(r.failures).toHaveLength(2);
  });

  it('research absente du joueur → considéré niveau 0', () => {
    const r = validateRequirements(
      [{ kind: 'research', researchId: 'inexistante', minLevel: 1 }],
      ctx,
    );
    expect(r.pass).toBe(false);
  });
});

describe('applyHullDelta', () => {
  it('addition normale', () => {
    expect(applyHullDelta(0.8, -0.2)).toBeCloseTo(0.6, 10);
    expect(applyHullDelta(0.5, 0.3)).toBeCloseTo(0.8, 10);
  });
  it('clamp à 0.01 minimum', () => {
    expect(applyHullDelta(0.05, -0.5)).toBe(0.01);
  });
  it('clamp à 1.0 maximum', () => {
    expect(applyHullDelta(0.9, 0.5)).toBe(1.0);
  });
});
