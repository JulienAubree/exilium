import { describe, it, expect } from 'vitest';
import { packCargos } from './cargo-pack';

const STATS = {
  smallCargo: { cargoCapacity: 5000 },
  largeCargo: { cargoCapacity: 25000 },
};

describe('packCargos', () => {
  it('retourne vide si needed <= 0', () => {
    expect(packCargos(0, { smallCargo: 5 }, STATS)).toEqual({ picked: {}, coveredCargo: 0 });
    expect(packCargos(-100, { smallCargo: 5 }, STATS)).toEqual({ picked: {}, coveredCargo: 0 });
  });

  it('prend petit cargo en premier', () => {
    const r = packCargos(4000, { smallCargo: 10, largeCargo: 5 }, STATS);
    expect(r.picked).toEqual({ smallCargo: 1 });
    expect(r.coveredCargo).toBe(5000);
  });

  it('passe au grand cargo quand le petit ne suffit pas', () => {
    const r = packCargos(60000, { smallCargo: 2, largeCargo: 5 }, STATS);
    // 2x small (10 000) puis ceil((60 000 - 10 000) / 25 000) = 2 large
    expect(r.picked).toEqual({ smallCargo: 2, largeCargo: 2 });
    expect(r.coveredCargo).toBe(60000);
  });

  it('cap a l\'inventaire dispo si insuffisant', () => {
    const r = packCargos(100000, { smallCargo: 1 }, STATS);
    expect(r.picked).toEqual({ smallCargo: 1 });
    expect(r.coveredCargo).toBe(5000);
    expect(r.coveredCargo).toBeLessThan(100000);
  });

  it('ignore les ships avec capacity 0 ou count 0', () => {
    const r = packCargos(5000, { smallCargo: 0, largeCargo: 1, espionageProbe: 10 }, {
      ...STATS,
      espionageProbe: { cargoCapacity: 0 },
    });
    expect(r.picked).toEqual({ largeCargo: 1 });
  });

  it('retourne vide si aucun cargo disponible', () => {
    expect(packCargos(1000, {}, STATS)).toEqual({ picked: {}, coveredCargo: 0 });
    expect(packCargos(1000, { smallCargo: 0, largeCargo: 0 }, STATS)).toEqual({ picked: {}, coveredCargo: 0 });
  });

  it('arrondit au nombre entier de vaisseaux superieur', () => {
    const r = packCargos(5001, { smallCargo: 10, largeCargo: 0 }, STATS);
    // 5001 needed → ceil(5001 / 5000) = 2 small
    expect(r.picked).toEqual({ smallCargo: 2 });
    expect(r.coveredCargo).toBe(10000);
  });
});
