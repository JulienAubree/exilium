import { describe, it, expect } from 'vitest';
import {
  calculateBuildingPoints,
  calculateResearchPoints,
  calculateFleetPoints,
  calculateDefensePoints,
  calculateTotalPoints,
} from './ranking.js';

describe('calculateBuildingPoints', () => {
  it('all level 0 = 0 points', () => {
    const levels = {
      metalMineLevel: 0, crystalMineLevel: 0, deutSynthLevel: 0,
      solarPlantLevel: 0, roboticsLevel: 0, shipyardLevel: 0,
      researchLabLevel: 0, storageMetalLevel: 0, storageCrystalLevel: 0,
      storageDeutLevel: 0,
    };
    expect(calculateBuildingPoints(levels)).toBe(0);
  });

  it('metal mine level 1 = floor((60+15) / 1000) = 0', () => {
    const levels = {
      metalMineLevel: 1, crystalMineLevel: 0, deutSynthLevel: 0,
      solarPlantLevel: 0, roboticsLevel: 0, shipyardLevel: 0,
      researchLabLevel: 0, storageMetalLevel: 0, storageCrystalLevel: 0,
      storageDeutLevel: 0,
    };
    expect(calculateBuildingPoints(levels)).toBe(0);
  });

  it('multiple buildings have cumulative points', () => {
    const levels = {
      metalMineLevel: 10, crystalMineLevel: 10, deutSynthLevel: 10,
      solarPlantLevel: 10, roboticsLevel: 5, shipyardLevel: 5,
      researchLabLevel: 5, storageMetalLevel: 3, storageCrystalLevel: 3,
      storageDeutLevel: 3,
    };
    expect(calculateBuildingPoints(levels)).toBeGreaterThan(0);
  });
});

describe('calculateResearchPoints', () => {
  it('all level 0 = 0 points', () => {
    const levels = {
      espionageTech: 0, computerTech: 0, energyTech: 0,
      combustion: 0, impulse: 0, hyperspaceDrive: 0,
      weapons: 0, shielding: 0, armor: 0,
    };
    expect(calculateResearchPoints(levels)).toBe(0);
  });

  it('weapons level 3 = 7 points', () => {
    const levels = {
      espionageTech: 0, computerTech: 0, energyTech: 0,
      combustion: 0, impulse: 0, hyperspaceDrive: 0,
      weapons: 3, shielding: 0, armor: 0,
    };
    // weapons baseCost: 800+200+0=1000, factor 2
    // level 1: 1000, level 2: 2000, level 3: 4000 → sum = 7000 → 7 points
    expect(calculateResearchPoints(levels)).toBe(7);
  });
});

describe('calculateFleetPoints', () => {
  it('no ships = 0', () => {
    expect(calculateFleetPoints({
      smallCargo: 0, largeCargo: 0, lightFighter: 0, heavyFighter: 0,
      cruiser: 0, battleship: 0, espionageProbe: 0, colonyShip: 0, recycler: 0,
    })).toBe(0);
  });

  it('10 small cargos = 40 points', () => {
    // cost per unit: 2000+2000+0=4000 → 10*4000=40000 → 40 points
    expect(calculateFleetPoints({
      smallCargo: 10, largeCargo: 0, lightFighter: 0, heavyFighter: 0,
      cruiser: 0, battleship: 0, espionageProbe: 0, colonyShip: 0, recycler: 0,
    })).toBe(40);
  });
});

describe('calculateDefensePoints', () => {
  it('no defenses = 0', () => {
    expect(calculateDefensePoints({
      rocketLauncher: 0, lightLaser: 0, heavyLaser: 0,
      gaussCannon: 0, plasmaTurret: 0, smallShield: 0, largeShield: 0,
    })).toBe(0);
  });

  it('5 rocket launchers = 10 points', () => {
    // cost per unit: 2000+0+0=2000 → 5*2000=10000 → 10 points
    expect(calculateDefensePoints({
      rocketLauncher: 5, lightLaser: 0, heavyLaser: 0,
      gaussCannon: 0, plasmaTurret: 0, smallShield: 0, largeShield: 0,
    })).toBe(10);
  });
});

describe('calculateTotalPoints', () => {
  it('sums all categories', () => {
    expect(calculateTotalPoints(10, 20, 30, 40)).toBe(100);
  });
});
