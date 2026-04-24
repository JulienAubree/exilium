import { describe, it, expect } from 'vitest';
import { simulateCombat } from './combat.js';
import { makeInput } from './combat.fixtures.js';
import type { CombatResult } from './combat.js';

/**
 * Scénarios canoniques verrouillés en snapshot. Tout changement de logique
 * qui modifie les chiffres fera tomber ces tests — c'est le signal qu'il
 * faut revalider manuellement chaque scénario avant de mettre à jour le snap.
 *
 * Chaque scénario utilise un rngSeed fixé pour la reproductibilité.
 */

function summarize(r: CombatResult) {
  return {
    outcome: r.outcome,
    roundsPlayed: r.rounds.length,
    attackerLosses: r.attackerLosses,
    defenderLosses: r.defenderLosses,
    debris: r.debris,
    repairedDefenses: r.repairedDefenses,
    totalShieldAbsorbedAttacker: r.attackerStats.shieldAbsorbed,
    totalShieldAbsorbedDefender: r.defenderStats.shieldAbsorbed,
    totalArmorBlockedAttacker: r.attackerStats.armorBlocked,
    totalArmorBlockedDefender: r.defenderStats.armorBlocked,
    totalOverkillAttacker: r.attackerStats.overkillWasted,
    totalOverkillDefender: r.defenderStats.overkillWasted,
  };
}

describe('combat scenarios (snapshot)', () => {
  it('scenario 01: small raid — 5 interceptors vs empty planet', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { interceptor: 5 },
      rngSeed: 1001,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 02: mirror match — 1 interceptor vs 1 interceptor', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { interceptor: 1 },
      defenderFleet: { interceptor: 1 },
      rngSeed: 1002,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 03: interceptor swarm vs frigate wall', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { interceptor: 15 },
      defenderFleet: { frigate: 4 },
      rngSeed: 1003,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 04: cruiser sweep vs interceptor swarm', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { cruiser: 3 },
      defenderFleet: { interceptor: 20 },
      rngSeed: 1004,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 05: battlecruisers vs frigates (counter expectation)', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { battlecruiser: 2 },
      defenderFleet: { frigate: 8 },
      rngSeed: 1005,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 06: balanced mixed fleet vs balanced mixed fleet', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { interceptor: 10, frigate: 5, cruiser: 2 },
      defenderFleet: { interceptor: 10, frigate: 5, cruiser: 2 },
      rngSeed: 1006,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 07: defended planet (fleet + defenses + level 3 shield)', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { cruiser: 5, battlecruiser: 2 },
      defenderFleet: { frigate: 4 },
      defenderDefenses: { rocketLauncher: 10, electromagneticCannon: 3 },
      planetaryShieldCapacity: 85, // level 3 après rebalance
      rngSeed: 1007,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 08: small raid blocked by oversized planetary shield', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { interceptor: 3 },
      defenderDefenses: { rocketLauncher: 5 },
      planetaryShieldCapacity: 500,
      rngSeed: 1008,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 09: massive raid overwhelms small shield', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { battlecruiser: 15 },
      defenderDefenses: { electromagneticCannon: 8 },
      planetaryShieldCapacity: 50,
      rngSeed: 1009,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 10: overkill showcase — battlecruisers vs weak fleet', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { battlecruiser: 8 },
      defenderFleet: { interceptor: 25 },
      rngSeed: 1010,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 11: late-game fight with researched fleets', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { interceptor: 20, frigate: 10, cruiser: 5, battlecruiser: 3 },
      attackerMultipliers: { weapons: 1.5, shielding: 1.4, armor: 1.5 },
      defenderFleet: { frigate: 8, cruiser: 4, battlecruiser: 2 },
      defenderDefenses: { rocketLauncher: 20, electromagneticCannon: 5 },
      defenderMultipliers: { weapons: 1.4, shielding: 1.5, armor: 1.4 },
      planetaryShieldCapacity: 250,
      rngSeed: 1011,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });

  it('scenario 12: support units survive when priority targets remain', () => {
    const r = simulateCombat(makeInput({
      attackerFleet: { cruiser: 2 },
      defenderFleet: { interceptor: 8, smallCargo: 10 },
      attackerTargetPriority: 'light',
      rngSeed: 1012,
    }));
    expect(summarize(r)).toMatchSnapshot();
  });
});
