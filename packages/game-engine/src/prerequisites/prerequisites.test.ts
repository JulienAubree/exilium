import { describe, it, expect } from 'vitest';
import { checkResearchPrerequisites, checkShipPrerequisites, checkDefensePrerequisites } from './prerequisites.js';
import type { PrerequisiteDef } from './prerequisites.js';

// Prerequisites from the constants
const RESEARCH_PREREQS: Record<string, PrerequisiteDef> = {
  espionageTech: { buildings: [{ buildingId: 'researchLab', level: 3 }] },
  combustion: {
    buildings: [{ buildingId: 'researchLab', level: 1 }],
    research: [{ researchId: 'energyTech', level: 1 }],
  },
};

const SHIP_PREREQS: Record<string, PrerequisiteDef> = {
  lightFighter: {
    buildings: [{ buildingId: 'shipyard', level: 1 }],
    research: [{ researchId: 'combustion', level: 1 }],
  },
  cruiser: {
    buildings: [{ buildingId: 'shipyard', level: 5 }],
    research: [
      { researchId: 'impulse', level: 4 },
      { researchId: 'weapons', level: 3 },
    ],
  },
};

const DEFENSE_PREREQS: Record<string, PrerequisiteDef> = {
  rocketLauncher: {
    buildings: [{ buildingId: 'shipyard', level: 1 }],
  },
  gaussCannon: {
    buildings: [{ buildingId: 'shipyard', level: 6 }],
    research: [
      { researchId: 'energyTech', level: 6 },
      { researchId: 'weapons', level: 3 },
      { researchId: 'shielding', level: 1 },
    ],
  },
};

describe('checkResearchPrerequisites', () => {
  it('espionage tech requires research lab 3', () => {
    const result = checkResearchPrerequisites(RESEARCH_PREREQS.espionageTech, { researchLabLevel: 2 }, {});
    expect(result.met).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('espionage tech passes with lab 3', () => {
    const result = checkResearchPrerequisites(RESEARCH_PREREQS.espionageTech, { researchLabLevel: 3 }, {});
    expect(result.met).toBe(true);
  });

  it('combustion requires energy tech 1 + lab 1', () => {
    const result = checkResearchPrerequisites(RESEARCH_PREREQS.combustion, { researchLabLevel: 1 }, { energyTech: 0 });
    expect(result.met).toBe(false);
  });

  it('combustion passes with energy tech 1 + lab 1', () => {
    const result = checkResearchPrerequisites(RESEARCH_PREREQS.combustion, { researchLabLevel: 1 }, { energyTech: 1 });
    expect(result.met).toBe(true);
  });
});

describe('checkShipPrerequisites', () => {
  it('light fighter requires shipyard 1 + combustion 1', () => {
    const result = checkShipPrerequisites(SHIP_PREREQS.lightFighter, { shipyardLevel: 0 }, {});
    expect(result.met).toBe(false);
  });

  it('light fighter passes', () => {
    const result = checkShipPrerequisites(SHIP_PREREQS.lightFighter, { shipyardLevel: 1 }, { combustion: 1 });
    expect(result.met).toBe(true);
  });

  it('cruiser needs shipyard 5 + impulse 4 + weapons 3', () => {
    const result = checkShipPrerequisites(SHIP_PREREQS.cruiser, { shipyardLevel: 5 }, { impulse: 3, weapons: 3 });
    expect(result.met).toBe(false);
  });

  it('cruiser passes', () => {
    const result = checkShipPrerequisites(SHIP_PREREQS.cruiser, { shipyardLevel: 5 }, { impulse: 4, weapons: 3 });
    expect(result.met).toBe(true);
  });
});

describe('checkDefensePrerequisites', () => {
  it('rocket launcher requires shipyard 1', () => {
    const result = checkDefensePrerequisites(DEFENSE_PREREQS.rocketLauncher, { shipyardLevel: 0 }, {});
    expect(result.met).toBe(false);
  });

  it('rocket launcher passes', () => {
    const result = checkDefensePrerequisites(DEFENSE_PREREQS.rocketLauncher, { shipyardLevel: 1 }, {});
    expect(result.met).toBe(true);
  });

  it('gauss cannon needs shipyard 6 + energy 6 + weapons 3 + shielding 1', () => {
    const result = checkDefensePrerequisites(DEFENSE_PREREQS.gaussCannon, { shipyardLevel: 6 }, { energyTech: 6, weapons: 2, shielding: 1 });
    expect(result.met).toBe(false);
  });
});
