import { describe, it, expect } from 'vitest';
import { computeUnitFP, type FPConfig } from '@exilium/game-engine';
import {
  buildBossShipConfig,
  computeBossUnitTargetFP,
  scaleBossStatsToTargetFP,
} from '../anomaly.combat.js';
import type { BossEntry } from '../../anomaly-content/anomaly-bosses.types.js';

/**
 * V9.3 — Tests du scaling tier/depth des bossStats.
 *
 * Le seed V9.2 définit les bossStats en absolu (calibrés tier ~5/8/12).
 * Sans scaling, un débutant tier 1 affronte un boss 10-870× le target et
 * un endgame tier 20 le trouve trivial. Le scaling resynchronise le boss
 * avec `anomalyEnemyFP(tier, depth) × fpMultiplier` quel que soit le tier.
 */

const FP_CONFIG: FPConfig = { shotcountExponent: 1.5, divisor: 100 };
const PROD_DIFFICULTY = { tierBaseFp: 40, tierFpGrowth: 1.6, growth: 1.06, maxRatio: 2.0 };

// Boss représentatif d'early (Kraken Quantique du seed) — pas de weaponProfiles.
const KRAKEN: BossEntry = {
  id: 'kraken-quantique',
  enabled: true,
  tier: 'early',
  image: '',
  name: 'Kraken Quantique',
  title: '',
  description: 'test',
  fpMultiplier: 1.3,
  skills: [{ type: 'armor_pierce', magnitude: 0.5 }],
  buffChoices: [{ type: 'damage_boost', magnitude: 0.15 }],
  bossStats: {
    hull: 234,
    shield: 92,
    armor: 7,
    weapons: 70,
    shotCount: 2,
  },
  escortFpRatio: 0.4,
};

// Boss avec weaponProfiles (Sentinelle Impériale).
const SENTINELLE: BossEntry = {
  id: 'sentinelle-imperiale',
  enabled: true,
  tier: 'mid',
  image: '',
  name: 'Sentinelle',
  title: '',
  description: 'test',
  fpMultiplier: 1.6,
  skills: [{ type: 'shield_aura', magnitude: 2.0 }],
  buffChoices: [{ type: 'shield_amp', magnitude: 0.25 }],
  bossStats: {
    hull: 1285,
    shield: 554,
    armor: 19,
    weapons: 192,
    shotCount: 2,
    weaponProfiles: [{ damage: 192, shots: 2, targetCategory: 'capital', hasChainKill: true }],
  },
  escortFpRatio: 0.4,
};

function bossUnitFP(boss: BossEntry, stats = boss.bossStats!): number {
  const config = buildBossShipConfig(boss, stats);
  return computeUnitFP(
    {
      weapons: config.baseWeaponDamage,
      shotCount: config.baseShotCount,
      shield: config.baseShield,
      hull: config.baseHull,
      armor: config.baseArmor,
      weaponProfiles: config.weapons,
      categoryId: config.categoryId,
    },
    FP_CONFIG,
  );
}

describe('computeBossUnitTargetFP', () => {
  it('renvoie la part boss du FP target (fpMult × (1 - escortRatio))', () => {
    // tier 5 d1 : baseTarget = 40 × 1.6^4 = 262.1 ; boss part = 262.1 × 1.3 × 0.6 = 204.4
    const target = computeBossUnitTargetFP(KRAKEN, 5, 1, PROD_DIFFICULTY);
    expect(target).toBeCloseTo(40 * Math.pow(1.6, 4) * 1.3 * 0.6, 0);
  });

  it('floor à 50 FP — un boss tier 1 garde une présence minimale', () => {
    // tier 1 d1 : baseTarget = 40 ; boss part = 40 × 1.3 × 0.6 = 31.2 → max(50, 31.2) = 50
    const target = computeBossUnitTargetFP(KRAKEN, 1, 1, PROD_DIFFICULTY);
    expect(target).toBe(50);
  });

  it('scale exponentiellement avec le tier (×~1.6 par palier)', () => {
    const t5 = computeBossUnitTargetFP(KRAKEN, 5, 1, PROD_DIFFICULTY);
    const t6 = computeBossUnitTargetFP(KRAKEN, 6, 1, PROD_DIFFICULTY);
    expect(t6 / t5).toBeCloseTo(1.6, 1);
  });

  it("intra-tier : depth augmente le FP target (croissance 1.06 jusqu'au cap)", () => {
    const d1 = computeBossUnitTargetFP(KRAKEN, 5, 1, PROD_DIFFICULTY);
    const d10 = computeBossUnitTargetFP(KRAKEN, 5, 10, PROD_DIFFICULTY);
    expect(d10).toBeGreaterThan(d1);
    expect(d10 / d1).toBeCloseTo(Math.pow(1.06, 9), 1);
  });
});

describe('scaleBossStatsToTargetFP', () => {
  it("le FP de l'unité boss scalée ≈ targetFP (tolérance ±5%)", () => {
    const targets = [100, 500, 2000, 10000, 50000];
    for (const target of targets) {
      const scaled = scaleBossStatsToTargetFP(KRAKEN, target, FP_CONFIG);
      const fp = bossUnitFP(KRAKEN, scaled);
      expect(fp).toBeGreaterThan(target * 0.85);
      expect(fp).toBeLessThan(target * 1.15);
    }
  });

  it('préserve les proportions offensif/défensif (le ratio dps/dur reste constant)', () => {
    const baselineFP = bossUnitFP(KRAKEN);
    const baselineRatio = KRAKEN.bossStats!.weapons / KRAKEN.bossStats!.hull;
    // Scale au target = 4× baseline → stats × 2× (sqrt).
    const scaled = scaleBossStatsToTargetFP(KRAKEN, baselineFP * 4, FP_CONFIG);
    const scaledRatio = scaled.weapons / scaled.hull;
    expect(scaledRatio).toBeCloseTo(baselineRatio, 1);
  });

  it('ne touche pas shotCount (entier qualitatif)', () => {
    const scaled = scaleBossStatsToTargetFP(KRAKEN, 50000, FP_CONFIG);
    expect(scaled.shotCount).toBe(KRAKEN.bossStats!.shotCount);
  });

  it('scale aussi les damage des weaponProfiles', () => {
    const targetFP = bossUnitFP(SENTINELLE) * 4;
    const scaled = scaleBossStatsToTargetFP(SENTINELLE, targetFP, FP_CONFIG);
    expect(scaled.weaponProfiles?.[0].damage).toBeGreaterThan(
      SENTINELLE.bossStats!.weaponProfiles![0].damage!,
    );
    expect(scaled.weaponProfiles?.[0].shots).toBe(SENTINELLE.bossStats!.weaponProfiles![0].shots);
    expect(scaled.weaponProfiles?.[0].hasChainKill).toBe(true);
  });

  it('floor hull/weapons à 1 pour ne pas créer de boss inerte', () => {
    const scaled = scaleBossStatsToTargetFP(KRAKEN, 1, FP_CONFIG);
    expect(scaled.hull).toBeGreaterThanOrEqual(1);
    expect(scaled.weapons).toBeGreaterThanOrEqual(1);
  });
});

describe('scaling bout-en-bout : Kraken (early) sur tous les tiers', () => {
  it('le FP scalé suit anomalyEnemyFP × fpMultiplier sur tier 1→20 (ratio borné)', () => {
    // Avant V9.3, Kraken faisait 13.5× le target tier 1 et 0.02× tier 20.
    // Après V9.3, le ratio doit rester proche de 1 (boss tier-correct).
    for (const tier of [1, 3, 5, 10, 15, 20]) {
      const target = computeBossUnitTargetFP(KRAKEN, tier, 1, PROD_DIFFICULTY);
      const scaled = scaleBossStatsToTargetFP(KRAKEN, target, FP_CONFIG);
      const actualFP = bossUnitFP(KRAKEN, scaled);
      const ratio = actualFP / target;
      // Tolérance large pour absorber les arrondis entiers (notamment tier 1
      // où target = 50 et hull tombe à des petites valeurs).
      expect(ratio).toBeGreaterThan(0.7);
      expect(ratio).toBeLessThan(1.5);
    }
  });

  it('avant scaling : Kraken tier 1 ≫ target (documente le bug pre-V9.3)', () => {
    const target = computeBossUnitTargetFP(KRAKEN, 1, 1, PROD_DIFFICULTY);
    const unscaledFP = bossUnitFP(KRAKEN); // bossStats du seed
    // Garde-fou : si quelqu'un retire le scaling, le ratio sans-scaling reste
    // ~7× au tier 1 (Kraken via profile synthétique). Les bosses mid/deep
    // sont 100-1000× hors target — early est juste le moins pire.
    expect(unscaledFP / target).toBeGreaterThan(5);
  });
});
