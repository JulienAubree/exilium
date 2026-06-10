import { describe, it, expect } from 'vitest';
import { vocationEffects, isVocationId } from './vocation.js';

describe('vocationEffects', () => {
  it('équilibrée (null) = neutre', () => {
    expect(vocationEffects(null, {})).toEqual({ productionDelta: 0, constructionTimeMult: 1 });
    expect(vocationEffects(undefined, {})).toEqual({ productionDelta: 0, constructionTimeMult: 1 });
    expect(vocationEffects('inconnue', {})).toEqual({ productionDelta: 0, constructionTimeMult: 1 });
  });

  it('minière : +20% production, +15% temps de construction (défauts)', () => {
    expect(vocationEffects('miniere', {})).toEqual({ productionDelta: 0.20, constructionTimeMult: 1.15 });
  });

  it('industrielle : −10% production, −20% temps de construction (défauts)', () => {
    expect(vocationEffects('industrielle', {})).toEqual({ productionDelta: -0.10, constructionTimeMult: 0.80 });
  });

  it('lit la config univers', () => {
    expect(vocationEffects('miniere', { vocation_miniere_production_bonus: 0.3, vocation_miniere_construction_malus: 0.25 }))
      .toEqual({ productionDelta: 0.3, constructionTimeMult: 1.25 });
  });
});

describe('isVocationId', () => {
  it('valide les ids connus uniquement', () => {
    expect(isVocationId('miniere')).toBe(true);
    expect(isVocationId('industrielle')).toBe(true);
    expect(isVocationId('capitale')).toBe(false);
    expect(isVocationId(null)).toBe(false);
  });
});
