import { describe, it, expect } from 'vitest';
import type { CombatResult } from '@exilium/game-engine';
import { aggregateRuns } from '../combat.service.js';

/** Fabrique un CombatResult minimal — seuls les champs lus par aggregateRuns comptent. */
function res(p: {
  outcome: 'attacker' | 'defender' | 'draw';
  rounds: number;
  attackerLosses?: Record<string, number>;
  defenderLosses?: Record<string, number>;
  debris?: { minerai: number; silicium: number };
}): CombatResult {
  return {
    rounds: Array.from({ length: p.rounds }, (_, i) => ({ round: i + 1 })),
    outcome: p.outcome,
    attackerLosses: p.attackerLosses ?? {},
    defenderLosses: p.defenderLosses ?? {},
    debris: p.debris ?? { minerai: 0, silicium: 0 },
    repairedDefenses: {},
    attackerStats: {},
    defenderStats: {},
  } as unknown as CombatResult;
}

describe('aggregateRuns', () => {
  it('renvoie un agrégat neutre pour zéro run (survivants = effectif initial)', () => {
    const out = aggregateRuns([], { interceptor: 10 });
    expect(out.winRate).toBe(0);
    expect(out.drawRate).toBe(0);
    expect(out.lossRate).toBe(0);
    expect(out.attacker.avgSurvivors).toEqual({ interceptor: 10 });
    expect(out.attacker.flagshipLossChance).toBe(0);
  });

  it('calcule des taux d’issue qui somment à 1, et la moyenne des rounds', () => {
    const out = aggregateRuns(
      [
        res({ outcome: 'attacker', rounds: 3 }),
        res({ outcome: 'attacker', rounds: 5 }),
        res({ outcome: 'draw', rounds: 6 }),
        res({ outcome: 'defender', rounds: 2 }),
      ],
      { interceptor: 20 },
    );
    expect(out.winRate).toBe(0.5);
    expect(out.drawRate).toBe(0.25);
    expect(out.lossRate).toBe(0.25);
    expect(out.winRate + out.drawRate + out.lossRate).toBeCloseTo(1);
    expect(out.avgRounds).toBe(4); // (3+5+6+2)/4
  });

  it('moyenne les pertes, en déduit les survivants et le risque sur l’amiral', () => {
    const out = aggregateRuns(
      [
        res({
          outcome: 'attacker',
          rounds: 1,
          attackerLosses: { interceptor: 4, flagship: 1 },
          defenderLosses: { missileLauncher: 2 },
          debris: { minerai: 100, silicium: 50 },
        }),
        res({
          outcome: 'attacker',
          rounds: 1,
          attackerLosses: { interceptor: 6 },
          defenderLosses: { missileLauncher: 4 },
          debris: { minerai: 300, silicium: 150 },
        }),
      ],
      { interceptor: 20, flagship: 1 },
    );
    expect(out.attacker.avgLosses.interceptor).toBe(5); // (4+6)/2
    expect(out.attacker.avgSurvivors.interceptor).toBe(15); // 20 − 5
    expect(out.attacker.avgSurvivors.flagship).toBe(0.5); // 1 − 0.5
    expect(out.attacker.flagshipLossChance).toBe(0.5); // 1 run sur 2
    expect(out.defender.avgLosses.missileLauncher).toBe(3); // (2+4)/2
    expect(out.avgDebris).toEqual({ minerai: 200, silicium: 100 }); // moyennes arrondies
  });
});
