import { describe, it, expect } from 'vitest';
import {
  policyEffects,
  empirePolicyCapacity,
  countActivePolicies,
  isPolicyAxis,
  isPolicyPosture,
  neutralPolicyEffects,
  POLICY_AXES,
} from './policy.js';

describe('policyEffects', () => {
  it('renvoie neutre pour une sélection vide', () => {
    expect(policyEffects({})).toEqual(neutralPolicyEffects());
    expect(policyEffects(null)).toEqual(neutralPolicyEffects());
  });

  it('somme la production et multiplie temps/exilium', () => {
    const e = policyEffects({ doctrine: 'croissance', fiscalite: 'rendement' });
    // production : +0.12 +0.10
    expect(e.productionDelta).toBeCloseTo(0.22);
    // exilium : ×0.90
    expect(e.exiliumGainMult).toBeCloseTo(0.9);
    // construction militaire : ×1.12 (croissance)
    expect(e.buildTimeMult.ship).toBeCloseTo(1.12);
    expect(e.buildTimeMult.defense).toBeCloseTo(1.12);
    expect(e.buildTimeMult.building).toBe(1);
  });

  it('cumule un bonus de slot et un malus de bâtiment', () => {
    const e = policyEffects({ logistique: 'mobilisation' });
    expect(e.fleetSlotBonus).toBe(1);
    expect(e.buildTimeMult.building).toBeCloseTo(1.1);
  });

  it('ignore les axes/postures inconnus', () => {
    const e = policyEffects({ inconnu: 'x', doctrine: 'pasuneposture' });
    expect(e).toEqual(neutralPolicyEffects());
  });
});

describe('empirePolicyCapacity', () => {
  it('1 slot au niveau 1, +1 tous les 10 niveaux, plafonné au nombre d’axes', () => {
    expect(empirePolicyCapacity(1, {})).toBe(1);
    expect(empirePolicyCapacity(10, {})).toBe(1);
    expect(empirePolicyCapacity(11, {})).toBe(2);
    expect(empirePolicyCapacity(21, {})).toBe(3);
    expect(empirePolicyCapacity(100, {})).toBe(POLICY_AXES.length); // plafond
  });

  it('respecte l’override universe', () => {
    expect(empirePolicyCapacity(6, { empire_policy_levels_per_slot: 5 })).toBe(2);
  });
});

describe('validation', () => {
  it('reconnaît axes et postures valides', () => {
    expect(isPolicyAxis('doctrine')).toBe(true);
    expect(isPolicyAxis('nope')).toBe(false);
    expect(isPolicyPosture('doctrine', 'croissance')).toBe(true);
    expect(isPolicyPosture('doctrine', 'nope')).toBe(false);
  });

  it('compte les postures non-neutres', () => {
    expect(countActivePolicies({ doctrine: 'croissance', fiscalite: 'rendement' })).toBe(2);
    expect(countActivePolicies({ doctrine: 'bidon' })).toBe(0);
  });
});
