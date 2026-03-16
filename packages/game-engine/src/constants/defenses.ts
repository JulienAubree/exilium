export type DefenseId =
  | 'rocketLauncher'
  | 'lightLaser'
  | 'heavyLaser'
  | 'gaussCannon'
  | 'plasmaTurret'
  | 'smallShield'
  | 'largeShield';

export interface DefenseDefinition {
  id: DefenseId;
  name: string;
  description: string;
  cost: { minerai: number; silicium: number; hydrogene: number };
  countColumn: string;
  maxPerPlanet?: number;
  prerequisites: {
    buildings?: { buildingId: string; level: number }[];
    research?: { researchId: string; level: number }[];
  };
}

export const DEFENSES: Record<DefenseId, DefenseDefinition> = {
  rocketLauncher: {
    id: 'rocketLauncher',
    name: 'Lanceur de missiles',
    description: 'Défense de base, peu coûteuse.',
    cost: { minerai: 2000, silicium: 0, hydrogene: 0 },
    countColumn: 'rocketLauncher',
    prerequisites: {
      buildings: [{ buildingId: 'shipyard', level: 1 }],
    },
  },
  lightLaser: {
    id: 'lightLaser',
    name: 'Artillerie laser légère',
    description: 'Défense laser de base.',
    cost: { minerai: 1500, silicium: 500, hydrogene: 0 },
    countColumn: 'lightLaser',
    prerequisites: {
      buildings: [{ buildingId: 'shipyard', level: 2 }],
      research: [{ researchId: 'energyTech', level: 1 }],
    },
  },
  heavyLaser: {
    id: 'heavyLaser',
    name: 'Artillerie laser lourde',
    description: 'Défense laser puissante.',
    cost: { minerai: 6000, silicium: 2000, hydrogene: 0 },
    countColumn: 'heavyLaser',
    prerequisites: {
      buildings: [{ buildingId: 'shipyard', level: 4 }],
      research: [
        { researchId: 'energyTech', level: 3 },
        { researchId: 'shielding', level: 1 },
      ],
    },
  },
  gaussCannon: {
    id: 'gaussCannon',
    name: 'Canon de Gauss',
    description: 'Défense balistique puissante.',
    cost: { minerai: 20000, silicium: 15000, hydrogene: 2000 },
    countColumn: 'gaussCannon',
    prerequisites: {
      buildings: [{ buildingId: 'shipyard', level: 6 }],
      research: [
        { researchId: 'energyTech', level: 6 },
        { researchId: 'weapons', level: 3 },
        { researchId: 'shielding', level: 1 },
      ],
    },
  },
  plasmaTurret: {
    id: 'plasmaTurret',
    name: 'Artillerie à ions',
    description: 'Défense plasma dévastatrice.',
    cost: { minerai: 50000, silicium: 50000, hydrogene: 30000 },
    countColumn: 'plasmaTurret',
    prerequisites: {
      buildings: [{ buildingId: 'shipyard', level: 8 }],
      research: [
        { researchId: 'energyTech', level: 8 },
        { researchId: 'weapons', level: 7 },
      ],
    },
  },
  smallShield: {
    id: 'smallShield',
    name: 'Petit bouclier',
    description: 'Bouclier planétaire de base.',
    cost: { minerai: 10000, silicium: 10000, hydrogene: 0 },
    countColumn: 'smallShield',
    maxPerPlanet: 1,
    prerequisites: {
      buildings: [{ buildingId: 'shipyard', level: 1 }],
      research: [{ researchId: 'shielding', level: 2 }],
    },
  },
  largeShield: {
    id: 'largeShield',
    name: 'Grand bouclier',
    description: 'Bouclier planétaire avancé.',
    cost: { minerai: 50000, silicium: 50000, hydrogene: 0 },
    countColumn: 'largeShield',
    maxPerPlanet: 1,
    prerequisites: {
      buildings: [{ buildingId: 'shipyard', level: 4 }],
      research: [{ researchId: 'shielding', level: 6 }],
    },
  },
};
