import { describe, it, expect } from 'vitest';
import {
  calculateBuildingPoints,
  calculateResearchPoints,
  calculateFleetPoints,
  calculateDefensePoints,
  calculateTotalPoints,
} from './ranking.js';
import type { BuildingDef, ResearchDef, UnitDef } from './ranking.js';

const BUILDING_DEFS: Record<string, BuildingDef> = {
  metalMine:      { levelColumn: 'metalMineLevel',      baseCost: { metal: 60,   crystal: 15,   deuterium: 0 },   costFactor: 1.5 },
  crystalMine:    { levelColumn: 'crystalMineLevel',    baseCost: { metal: 48,   crystal: 24,   deuterium: 0 },   costFactor: 1.6 },
  deutSynth:      { levelColumn: 'deutSynthLevel',      baseCost: { metal: 225,  crystal: 75,   deuterium: 0 },   costFactor: 1.5 },
  solarPlant:     { levelColumn: 'solarPlantLevel',     baseCost: { metal: 75,   crystal: 30,   deuterium: 0 },   costFactor: 1.5 },
  robotics:       { levelColumn: 'roboticsLevel',       baseCost: { metal: 400,  crystal: 120,  deuterium: 200 }, costFactor: 2 },
  shipyard:       { levelColumn: 'shipyardLevel',       baseCost: { metal: 400,  crystal: 200,  deuterium: 100 }, costFactor: 2 },
  researchLab:    { levelColumn: 'researchLabLevel',    baseCost: { metal: 200,  crystal: 400,  deuterium: 200 }, costFactor: 2 },
  storageMetal:   { levelColumn: 'storageMetalLevel',   baseCost: { metal: 1000, crystal: 0,    deuterium: 0 },   costFactor: 2 },
  storageCrystal: { levelColumn: 'storageCrystalLevel', baseCost: { metal: 1000, crystal: 500,  deuterium: 0 },   costFactor: 2 },
  storageDeut:    { levelColumn: 'storageDeutLevel',    baseCost: { metal: 1000, crystal: 1000, deuterium: 0 },   costFactor: 2 },
};

const RESEARCH_DEFS: Record<string, ResearchDef> = {
  espionageTech:  { levelColumn: 'espionageTech',  baseCost: { metal: 200,   crystal: 1000,  deuterium: 200 },  costFactor: 2 },
  computerTech:   { levelColumn: 'computerTech',   baseCost: { metal: 0,     crystal: 400,   deuterium: 600 },  costFactor: 2 },
  energyTech:     { levelColumn: 'energyTech',     baseCost: { metal: 0,     crystal: 800,   deuterium: 400 },  costFactor: 2 },
  combustion:     { levelColumn: 'combustion',     baseCost: { metal: 400,   crystal: 0,     deuterium: 600 },  costFactor: 2 },
  impulse:        { levelColumn: 'impulse',        baseCost: { metal: 2000,  crystal: 4000,  deuterium: 600 },  costFactor: 2 },
  hyperspaceDrive:{ levelColumn: 'hyperspaceDrive', baseCost: { metal: 10000, crystal: 20000, deuterium: 6000 }, costFactor: 2 },
  weapons:        { levelColumn: 'weapons',        baseCost: { metal: 800,   crystal: 200,   deuterium: 0 },    costFactor: 2 },
  shielding:      { levelColumn: 'shielding',      baseCost: { metal: 200,   crystal: 600,   deuterium: 0 },    costFactor: 2 },
  armor:          { levelColumn: 'armor',          baseCost: { metal: 1000,  crystal: 0,     deuterium: 0 },    costFactor: 2 },
};

const SHIP_DEFS: Record<string, UnitDef> = {
  smallCargo:     { countColumn: 'smallCargo',     cost: { metal: 2000,  crystal: 2000,  deuterium: 0 } },
  largeCargo:     { countColumn: 'largeCargo',     cost: { metal: 6000,  crystal: 6000,  deuterium: 0 } },
  lightFighter:   { countColumn: 'lightFighter',   cost: { metal: 3000,  crystal: 1000,  deuterium: 0 } },
  heavyFighter:   { countColumn: 'heavyFighter',   cost: { metal: 6000,  crystal: 4000,  deuterium: 0 } },
  cruiser:        { countColumn: 'cruiser',        cost: { metal: 20000, crystal: 7000,  deuterium: 2000 } },
  battleship:     { countColumn: 'battleship',     cost: { metal: 45000, crystal: 15000, deuterium: 0 } },
  espionageProbe: { countColumn: 'espionageProbe', cost: { metal: 0,     crystal: 1000,  deuterium: 0 } },
  colonyShip:     { countColumn: 'colonyShip',     cost: { metal: 10000, crystal: 20000, deuterium: 10000 } },
  recycler:       { countColumn: 'recycler',       cost: { metal: 10000, crystal: 6000,  deuterium: 2000 } },
};

const DEFENSE_DEFS: Record<string, UnitDef> = {
  rocketLauncher: { countColumn: 'rocketLauncher', cost: { metal: 2000,  crystal: 0,     deuterium: 0 } },
  lightLaser:     { countColumn: 'lightLaser',     cost: { metal: 1500,  crystal: 500,   deuterium: 0 } },
  heavyLaser:     { countColumn: 'heavyLaser',     cost: { metal: 6000,  crystal: 2000,  deuterium: 0 } },
  gaussCannon:    { countColumn: 'gaussCannon',    cost: { metal: 20000, crystal: 15000, deuterium: 2000 } },
  plasmaTurret:   { countColumn: 'plasmaTurret',   cost: { metal: 50000, crystal: 50000, deuterium: 30000 } },
  smallShield:    { countColumn: 'smallShield',    cost: { metal: 10000, crystal: 10000, deuterium: 0 } },
  largeShield:    { countColumn: 'largeShield',    cost: { metal: 50000, crystal: 50000, deuterium: 0 } },
};

describe('calculateBuildingPoints', () => {
  it('all level 0 = 0 points', () => {
    const levels = {
      metalMineLevel: 0, crystalMineLevel: 0, deutSynthLevel: 0,
      solarPlantLevel: 0, roboticsLevel: 0, shipyardLevel: 0,
      researchLabLevel: 0, storageMetalLevel: 0, storageCrystalLevel: 0,
      storageDeutLevel: 0,
    };
    expect(calculateBuildingPoints(levels, BUILDING_DEFS)).toBe(0);
  });

  it('metal mine level 1 = floor((60+15) / 1000) = 0', () => {
    const levels = {
      metalMineLevel: 1, crystalMineLevel: 0, deutSynthLevel: 0,
      solarPlantLevel: 0, roboticsLevel: 0, shipyardLevel: 0,
      researchLabLevel: 0, storageMetalLevel: 0, storageCrystalLevel: 0,
      storageDeutLevel: 0,
    };
    expect(calculateBuildingPoints(levels, BUILDING_DEFS)).toBe(0);
  });

  it('multiple buildings have cumulative points', () => {
    const levels = {
      metalMineLevel: 10, crystalMineLevel: 10, deutSynthLevel: 10,
      solarPlantLevel: 10, roboticsLevel: 5, shipyardLevel: 5,
      researchLabLevel: 5, storageMetalLevel: 3, storageCrystalLevel: 3,
      storageDeutLevel: 3,
    };
    expect(calculateBuildingPoints(levels, BUILDING_DEFS)).toBeGreaterThan(0);
  });
});

describe('calculateResearchPoints', () => {
  it('all level 0 = 0 points', () => {
    const levels = {
      espionageTech: 0, computerTech: 0, energyTech: 0,
      combustion: 0, impulse: 0, hyperspaceDrive: 0,
      weapons: 0, shielding: 0, armor: 0,
    };
    expect(calculateResearchPoints(levels, RESEARCH_DEFS)).toBe(0);
  });

  it('weapons level 3 = 7 points', () => {
    const levels = {
      espionageTech: 0, computerTech: 0, energyTech: 0,
      combustion: 0, impulse: 0, hyperspaceDrive: 0,
      weapons: 3, shielding: 0, armor: 0,
    };
    expect(calculateResearchPoints(levels, RESEARCH_DEFS)).toBe(7);
  });
});

describe('calculateFleetPoints', () => {
  it('no ships = 0', () => {
    expect(calculateFleetPoints({
      smallCargo: 0, largeCargo: 0, lightFighter: 0, heavyFighter: 0,
      cruiser: 0, battleship: 0, espionageProbe: 0, colonyShip: 0, recycler: 0,
    }, SHIP_DEFS)).toBe(0);
  });

  it('10 small cargos = 40 points', () => {
    expect(calculateFleetPoints({
      smallCargo: 10, largeCargo: 0, lightFighter: 0, heavyFighter: 0,
      cruiser: 0, battleship: 0, espionageProbe: 0, colonyShip: 0, recycler: 0,
    }, SHIP_DEFS)).toBe(40);
  });
});

describe('calculateDefensePoints', () => {
  it('no defenses = 0', () => {
    expect(calculateDefensePoints({
      rocketLauncher: 0, lightLaser: 0, heavyLaser: 0,
      gaussCannon: 0, plasmaTurret: 0, smallShield: 0, largeShield: 0,
    }, DEFENSE_DEFS)).toBe(0);
  });

  it('5 rocket launchers = 10 points', () => {
    expect(calculateDefensePoints({
      rocketLauncher: 5, lightLaser: 0, heavyLaser: 0,
      gaussCannon: 0, plasmaTurret: 0, smallShield: 0, largeShield: 0,
    }, DEFENSE_DEFS)).toBe(10);
  });
});

describe('calculateTotalPoints', () => {
  it('sums all categories', () => {
    expect(calculateTotalPoints(10, 20, 30, 40)).toBe(100);
  });
});
