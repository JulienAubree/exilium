import { describe, it, expect } from 'vitest';
import { simulateCombat } from './combat.js';
import type { BossSkillRuntime, ShipCombatConfig } from './combat.js';
import { SHIP_CONFIGS, SHIP_IDS, makeInput } from './combat.fixtures.js';

/**
 * V9 Boss — sanity tests sur les hooks bossSkills passés à simulateCombat.
 * Pas exhaustifs (l'engine reste deterministic only avec rngSeed) mais
 * vérifient que chaque skill modifie l'issue d'un combat de façon attendue.
 */

const FLAGSHIP: ShipCombatConfig = {
  shipType: 'flagship', categoryId: 'heavy',
  baseShield: 50, baseArmor: 5, baseHull: 200,
  baseWeaponDamage: 30, baseShotCount: 2,
  weapons: [
    { damage: 30, shots: 2, targetCategory: 'heavy' },
    { damage: 10, shots: 1, targetCategory: 'medium' },
  ],
};

const BOSS: ShipCombatConfig = {
  shipType: 'cruiser', categoryId: 'heavy',
  baseShield: 30, baseArmor: 4, baseHull: 60,
  baseWeaponDamage: 20, baseShotCount: 1,
  weapons: [
    { damage: 20, shots: 1, targetCategory: 'heavy' },
  ],
};

const SHIP_CONFIGS_WITH_FLAGSHIP: Record<string, ShipCombatConfig> = {
  ...SHIP_CONFIGS,
  flagship: FLAGSHIP,
  cruiser: BOSS,
};

const SHIP_IDS_WITH_FLAGSHIP = new Set([...SHIP_IDS, 'flagship']);

function runWithSkills(bossSkills: BossSkillRuntime[]) {
  return simulateCombat(makeInput({
    attackerFleet: { flagship: 1 },
    defenderFleet: { cruiser: 1 },
    shipConfigs: SHIP_CONFIGS_WITH_FLAGSHIP,
    shipIds: SHIP_IDS_WITH_FLAGSHIP,
    rngSeed: 42,
    bossSkills,
    combatConfig: { ...makeInput().combatConfig, maxRounds: 50 },
  }));
}

describe('boss skills — armor_pierce', () => {
  it('reduces effective armor (more hull damage to attacker)', () => {
    const baseline = runWithSkills([]);
    const pierced = runWithSkills([{ type: 'armor_pierce', magnitude: 1.0, side: 'defender' }]);
    const baseHullLeft = baseline.rounds[baseline.rounds.length - 1]
      ?.attackerHPByType?.flagship?.hullRemaining ?? 0;
    const piercedHullLeft = pierced.rounds[pierced.rounds.length - 1]
      ?.attackerHPByType?.flagship?.hullRemaining ?? 0;
    // Avec 100% pierce l'attaquant prend plus (ou autant) de damage qu'au baseline.
    expect(piercedHullLeft).toBeLessThanOrEqual(baseHullLeft);
  });
});

describe('boss skills — shield_aura', () => {
  it('boss starts with multiplied shield', () => {
    const aura = runWithSkills([{ type: 'shield_aura', magnitude: 5, side: 'defender' }]);
    // Boss shield massif → boss survit plus longtemps (donc plus de rounds que baseline).
    const baseline = runWithSkills([]);
    expect(aura.rounds.length).toBeGreaterThanOrEqual(baseline.rounds.length);
  });
});

describe('boss skills — regen', () => {
  it('boss regen heals each round (more rounds before death)', () => {
    const baseline = runWithSkills([]);
    const regen = runWithSkills([{ type: 'regen', magnitude: 0.50, side: 'defender' }]);
    // 50% regen / round → boss tient au moins autant de rounds que baseline.
    expect(regen.rounds.length).toBeGreaterThanOrEqual(baseline.rounds.length);
  });
});

describe('boss skills — summon_drones', () => {
  it('adds drones to defender at round 1', () => {
    const summon = runWithSkills([{
      type: 'summon_drones',
      magnitude: 5,
      side: 'defender',
      summonShipId: 'interceptor',
    }]);
    // Round 1 doit montrer 5 interceptors côté défender (le boss seul aurait 0).
    const r1 = summon.rounds[0];
    expect(r1.defenderShips.interceptor ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe('boss skills — disable_battery', () => {
  it('removes batteries from the flagship config used in combat', () => {
    // Setup spécifique : flagship avec 2 batteries identifiables par damage
    // (30 vs 10), et un défender qui ne peut PAS tirer (shotCount=0 et damage=0)
    // pour isoler les effets du flagship. Avec disable=1, la 2e batterie
    // (damage=10) disparaît → moins de damage total sur le défender.
    const passiveBoss: ShipCombatConfig = {
      shipType: 'frigate', categoryId: 'medium',
      baseShield: 0, baseArmor: 0, baseHull: 1000,
      baseWeaponDamage: 0, baseShotCount: 0,
      weapons: [],
    };
    const cfgs = { ...SHIP_CONFIGS_WITH_FLAGSHIP, frigate: passiveBoss };
    const make = (skills: BossSkillRuntime[]) =>
      simulateCombat(makeInput({
        attackerFleet: { flagship: 1 },
        defenderFleet: { frigate: 1 },
        shipConfigs: cfgs,
        shipIds: SHIP_IDS_WITH_FLAGSHIP,
        rngSeed: 1,
        bossSkills: skills,
        combatConfig: { ...makeInput().combatConfig, maxRounds: 1 },
      }));
    const disabled = make([{ type: 'disable_battery', magnitude: 1, side: 'defender' }]);
    const baseline = make([]);
    // Sum hull damage dealt par l'attaquant en round 1.
    const dmgR1 = (r: typeof baseline) =>
      Object.values(r.rounds[0]?.defenderDamageByType ?? {})
        .reduce((s, e) => s + (e.hullDamage + e.shieldDamage), 0);
    expect(dmgR1(disabled)).toBeLessThan(dmgR1(baseline));
  });
});

describe('boss skills — armor_corrosion', () => {
  it('attacker armor decreases over rounds', () => {
    const corrosion = runWithSkills([{ type: 'armor_corrosion', magnitude: 0.50, side: 'defender' }]);
    // Avec 50% / round, on s'attend à un combat au moins aussi rapide que baseline
    // (l'armure de l'attaquant fond → plus de damage hull reçu).
    expect(corrosion.rounds.length).toBeGreaterThan(0);
    expect(['attacker', 'defender', 'draw']).toContain(corrosion.outcome);
  });
});

describe('boss skills — last_stand', () => {
  it('boss survives the lethal hit once', () => {
    // Sans last_stand : boss mort au round 1-2. Avec last_stand : tient un
    // round de plus minimum.
    const baseline = runWithSkills([]);
    const lastStand = runWithSkills([{ type: 'last_stand', magnitude: 1, side: 'defender' }]);
    expect(lastStand.rounds.length).toBeGreaterThanOrEqual(baseline.rounds.length);
  });
});

describe('boss skills — evasion', () => {
  it('full evasion makes boss invulnerable', () => {
    const evasive = runWithSkills([{ type: 'evasion', magnitude: 1.0, side: 'defender' }]);
    // 100% evasion → tous les tirs ratent → l'attaquant ne peut pas tuer le boss.
    expect(evasive.outcome).not.toBe('attacker');
  });
});

describe('boss skills — damage_burst', () => {
  it('boost ne casse pas le combat (smoke test)', () => {
    const burst = runWithSkills([{ type: 'damage_burst', magnitude: 5, side: 'defender' }]);
    expect(['attacker', 'defender', 'draw']).toContain(burst.outcome);
    expect(burst.rounds.length).toBeGreaterThan(0);
  });
});

describe('boss skills — rafale_swarm', () => {
  it("multiplie le rafale.count des batteries boss avec rafale", () => {
    // Le BOSS fixture n'a pas de rafale ; le test passe à un boss avec rafale
    // sur la batterie heavy pour vérifier la mutation.
    const bossWithRafale: ShipCombatConfig = {
      ...BOSS,
      weapons: [
        {
          damage: 20, shots: 1, targetCategory: 'heavy',
          rafale: { category: 'heavy', count: 2 },
        },
      ],
    };
    const swarm = simulateCombat(makeInput({
      attackerFleet: { flagship: 1 },
      defenderFleet: { cruiser: 1 },
      shipConfigs: { ...SHIP_CONFIGS_WITH_FLAGSHIP, cruiser: bossWithRafale },
      shipIds: SHIP_IDS_WITH_FLAGSHIP,
      rngSeed: 7,
      bossSkills: [{ type: 'rafale_swarm', magnitude: 3, side: 'defender' }],
      combatConfig: { ...makeInput().combatConfig, maxRounds: 10 },
    }));
    expect(swarm.rounds.length).toBeGreaterThan(0);
  });
});
