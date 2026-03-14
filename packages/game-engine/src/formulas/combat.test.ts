import { describe, it, expect } from 'vitest';
import { simulateCombat, calculateDebris, repairDefenses } from './combat.js';

const zeroTechs = { weapons: 0, shielding: 0, armor: 0 };

describe('calculateDebris', () => {
  it('returns 30% metal/crystal from destroyed ships', () => {
    // lightFighter costs { metal: 3000, crystal: 1000 }
    const debris = calculateDebris({ lightFighter: 10 }, {});
    expect(debris.metal).toBe(Math.floor(3000 * 10 * 0.3));
    expect(debris.crystal).toBe(Math.floor(1000 * 10 * 0.3));
  });

  it('ignores defenses in debris calculation', () => {
    const debris = calculateDebris({}, { rocketLauncher: 100 });
    expect(debris.metal).toBe(0);
    expect(debris.crystal).toBe(0);
  });

  it('floors the result', () => {
    // espionageProbe costs { metal: 0, crystal: 1000 }
    const debris = calculateDebris({ espionageProbe: 1 }, {});
    expect(debris.metal).toBe(0);
    expect(debris.crystal).toBe(Math.floor(1000 * 0.3));
  });

  it('combines attacker and defender ship losses', () => {
    const debris = calculateDebris(
      { lightFighter: 5 },
      { lightFighter: 3 },
    );
    expect(debris.metal).toBe(Math.floor(3000 * 8 * 0.3));
    expect(debris.crystal).toBe(Math.floor(1000 * 8 * 0.3));
  });
});

describe('simulateCombat', () => {
  it('attacker wins asymmetric battle', () => {
    const result = simulateCombat(
      { battleship: 50 },
      { lightFighter: 10 },
      zeroTechs,
      zeroTechs,
    );
    expect(result.outcome).toBe('attacker');
    expect(result.rounds.length).toBeGreaterThanOrEqual(1);
    expect(result.rounds.length).toBeLessThanOrEqual(6);
  });

  it('attacker wins against empty defender', () => {
    const result = simulateCombat(
      { lightFighter: 5 },
      {},
      zeroTechs,
      zeroTechs,
    );
    expect(result.outcome).toBe('attacker');
    expect(result.rounds.length).toBe(1);
    expect(result.attackerLosses).toEqual({});
  });

  it('combat lasts at most 6 rounds', () => {
    const result = simulateCombat(
      { lightFighter: 1 },
      { lightFighter: 1 },
      zeroTechs,
      zeroTechs,
    );
    expect(result.rounds.length).toBeLessThanOrEqual(6);
  });

  it('probes bounce off battleship shields (damage < 1% shield)', () => {
    // espionageProbe: weapons=0, battleship: shield=200
    // 0 < 0.01 * 200 = 2, so bounce — probes deal no damage
    const result = simulateCombat(
      { espionageProbe: 5 },
      { battleship: 1 },
      zeroTechs,
      zeroTechs,
    );
    // Battleship should survive unscathed (probes bounce)
    expect(result.outcome).toBe('defender');
    // All probes should be destroyed
    expect(result.attackerLosses.espionageProbe).toBe(5);
  });

  it('techs increase effective stats by 10% per level', () => {
    // Verify through a very asymmetric scenario:
    // With weapons tech 10, a lightFighter deals 50 * (1 + 0.1*10) = 100 damage
    // Without tech, it deals 50 damage
    // 1 battleship with tech=0: armor=60000, needs 70% damage = 42000 to trigger destruction
    // A large fleet with high weapons tech should destroy it faster
    const highWeaponsTech = { weapons: 20, shielding: 0, armor: 0 };
    // lightFighter weapons = 50 * (1 + 0.1*20) = 150 per fighter
    // vs battleship armor 60000, shield 200
    // 100 fighters * 150 = 15000 damage per round vs shield+armor
    // This should destroy the battleship
    const result = simulateCombat(
      { lightFighter: 100 },
      { battleship: 1 },
      highWeaponsTech,
      zeroTechs,
    );
    // With 100 lightFighters at 150 weapons each, should destroy 1 battleship
    expect(result.defenderLosses.battleship ?? 0).toBe(1);
  });

  it('generates debris from destroyed ships', () => {
    const result = simulateCombat(
      { battleship: 50 },
      { lightFighter: 100 },
      zeroTechs,
      zeroTechs,
    );
    // Should have some debris from destroyed lightFighters
    expect(result.debris.metal).toBeGreaterThan(0);
    expect(result.debris.crystal).toBeGreaterThan(0);
  });

  it('repairs approximately 70% of destroyed defenses', () => {
    // Run multiple times for statistical validity
    let totalDestroyed = 0;
    let totalRepaired = 0;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const result = simulateCombat(
        { battleship: 50 },
        { rocketLauncher: 50 },
        zeroTechs,
        zeroTechs,
      );
      const destroyed = result.defenderLosses.rocketLauncher ?? 0;
      const repaired = result.repairedDefenses.rocketLauncher ?? 0;
      totalDestroyed += destroyed;
      totalRepaired += repaired;
    }

    if (totalDestroyed > 0) {
      const ratio = totalRepaired / totalDestroyed;
      // Should be approximately 0.7, allow ±0.15 margin
      expect(ratio).toBeGreaterThan(0.55);
      expect(ratio).toBeLessThan(0.85);
    }
  });

  it('rapid fire: cruisers decimate rocket launchers', () => {
    // Cruisers have rapid fire 10 against rocketLauncher
    const result = simulateCombat(
      { cruiser: 10 },
      { rocketLauncher: 50 },
      zeroTechs,
      zeroTechs,
    );
    expect(result.outcome).toBe('attacker');
    // Should finish relatively quickly due to rapid fire
    expect(result.rounds.length).toBeLessThanOrEqual(6);
  });
});

describe('repairDefenses', () => {
  it('only repairs defense types, not ships', () => {
    const repaired = repairDefenses({ lightFighter: 10 });
    expect(repaired.lightFighter).toBeUndefined();
  });

  it('repairs approximately 70% of defenses over many runs', () => {
    let totalRepaired = 0;
    const count = 100;
    const destroyed = 1000;

    for (let i = 0; i < count; i++) {
      const repaired = repairDefenses({ rocketLauncher: destroyed });
      totalRepaired += repaired.rocketLauncher ?? 0;
    }

    const ratio = totalRepaired / (count * destroyed);
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.75);
  });
});
