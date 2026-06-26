import { describe, it, expect } from 'vitest';
import { simulateCombat } from './combat.js';
import type { ShipCombatConfig } from './combat.js';
import { COMBAT_CONFIG, makeInput, NO_BONUS } from './combat.fixtures.js';

/**
 * T3 — Stat combat `shield_pierce` (fork Armement « Anti-bouclier »).
 *
 * Un attaquant avec `attackerShieldPierce ∈ [0,1)` ignore cette fraction de
 * l'absorption bouclier de la cible : l'attaquant dépose moins de dégâts dans
 * le bouclier et davantage dans la coque. Symétrique à `armor_pierce` mais
 * porté côté attaquant pour le combat normal (S1 : seul l'attaquant perce).
 *
 * Scénario déterministe : 1 attaquant 1 shot de dégâts D vs 1 défenseur
 * bouclier S avec S < D, armor 0, hull élevé (ne meurt pas) → mesure directe
 * de `defenderStats.shieldAbsorbed` et du hull damage.
 */

// Attaquant : 1 batterie, 1 shot, damage 100, cible la catégorie 'heavy'.
const PIERCER: ShipCombatConfig = {
  shipType: 'piercer', categoryId: 'light',
  baseShield: 0, baseArmor: 0, baseHull: 1000, baseWeaponDamage: 100, baseShotCount: 1,
  weapons: [{ damage: 100, shots: 1, targetCategory: 'heavy' }],
};

// Défenseur : shield 40 (< 100), armor 0, hull énorme → survit, ne riposte pas.
const SHIELDED_TARGET: ShipCombatConfig = {
  shipType: 'shieldedTarget', categoryId: 'heavy',
  baseShield: 40, baseArmor: 0, baseHull: 100000, baseWeaponDamage: 0, baseShotCount: 0,
  weapons: [],
};

const SHIP_CONFIGS: Record<string, ShipCombatConfig> = {
  piercer: PIERCER,
  shieldedTarget: SHIELDED_TARGET,
};

const D = 100;
const S = 40;

function runRound1(attackerShieldPierce?: number) {
  const result = simulateCombat(makeInput({
    attackerFleet: { piercer: 1 },
    defenderFleet: { shieldedTarget: 1 },
    defenderDefenses: {},
    attackerMultipliers: { ...NO_BONUS, ...(attackerShieldPierce !== undefined ? { shieldPierce: attackerShieldPierce } : {}) },
    defenderMultipliers: NO_BONUS,
    shipConfigs: SHIP_CONFIGS,
    shipIds: new Set(['piercer', 'shieldedTarget']),
    defenseIds: new Set<string>(),
    combatConfig: { ...COMBAT_CONFIG, maxRounds: 1 },
    rngSeed: 1,
  }));
  return result.rounds[0];
}

describe('combat — shield_pierce (attacker)', () => {
  it('sans pierce : tout le bouclier absorbe (== S), hull = D - S', () => {
    const round = runRound1(); // no shieldPierce → default 0
    expect(round.defenderStats.shieldAbsorbed).toBe(S);
    const hullDmg = round.defenderDamageByType?.shieldedTarget?.hullDamage ?? 0;
    expect(hullDmg).toBe(D - S);
  });

  it('attackerShieldPierce=0.5 : bouclier absorbe S*0.5, hull damage augmenté d\'autant', () => {
    const round = runRound1(0.5);
    expect(round.defenderStats.shieldAbsorbed).toBe(S * 0.5);
    const hullDmg = round.defenderDamageByType?.shieldedTarget?.hullDamage ?? 0;
    // surplus = D - effShield = D - S*0.5 ; armor 0 → hull damage = surplus
    expect(hullDmg).toBe(D - S * 0.5);
  });

  it('attackerShieldPierce=0 : strictement identique au cas sans pierce (non-régression)', () => {
    const round = runRound1(0);
    expect(round.defenderStats.shieldAbsorbed).toBe(S);
    const hullDmg = round.defenderDamageByType?.shieldedTarget?.hullDamage ?? 0;
    expect(hullDmg).toBe(D - S);
  });
});
