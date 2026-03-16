export type BuildingId =
  | 'mineraiMine'
  | 'siliciumMine'
  | 'hydrogeneSynth'
  | 'solarPlant'
  | 'robotics'
  | 'shipyard'
  | 'researchLab'
  | 'storageMinerai'
  | 'storageSilicium'
  | 'storageHydrogene';

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  baseCost: { minerai: number; silicium: number; hydrogene: number };
  costFactor: number;
  baseTime: number;
  levelColumn: string;
  prerequisites: { buildingId: BuildingId; level: number }[];
}

export const BUILDINGS: Record<BuildingId, BuildingDefinition> = {
  mineraiMine: {
    id: 'mineraiMine',
    name: 'Mine de minerai',
    description: 'Produit du minerai, ressource de base.',
    baseCost: { minerai: 60, silicium: 15, hydrogene: 0 },
    costFactor: 1.5,
    baseTime: 60,
    levelColumn: 'mineraiMineLevel',
    prerequisites: [],
  },
  siliciumMine: {
    id: 'siliciumMine',
    name: 'Mine de silicium',
    description: 'Produit du silicium.',
    baseCost: { minerai: 48, silicium: 24, hydrogene: 0 },
    costFactor: 1.6,
    baseTime: 60,
    levelColumn: 'siliciumMineLevel',
    prerequisites: [],
  },
  hydrogeneSynth: {
    id: 'hydrogeneSynth',
    name: "Synthétiseur d'hydrogène",
    description: "Produit de l'hydrogène.",
    baseCost: { minerai: 225, silicium: 75, hydrogene: 0 },
    costFactor: 1.5,
    baseTime: 60,
    levelColumn: 'hydrogeneSynthLevel',
    prerequisites: [],
  },
  solarPlant: {
    id: 'solarPlant',
    name: 'Centrale solaire',
    description: "Produit de l'énergie.",
    baseCost: { minerai: 75, silicium: 30, hydrogene: 0 },
    costFactor: 1.5,
    baseTime: 60,
    levelColumn: 'solarPlantLevel',
    prerequisites: [],
  },
  robotics: {
    id: 'robotics',
    name: 'Usine de robots',
    description: 'Réduit le temps de construction.',
    baseCost: { minerai: 400, silicium: 120, hydrogene: 200 },
    costFactor: 2,
    baseTime: 60,
    levelColumn: 'roboticsLevel',
    prerequisites: [],
  },
  shipyard: {
    id: 'shipyard',
    name: 'Chantier spatial',
    description: 'Construit vaisseaux et défenses.',
    baseCost: { minerai: 400, silicium: 200, hydrogene: 100 },
    costFactor: 2,
    baseTime: 60,
    levelColumn: 'shipyardLevel',
    prerequisites: [{ buildingId: 'robotics', level: 2 }],
  },
  researchLab: {
    id: 'researchLab',
    name: 'Laboratoire de recherche',
    description: 'Permet les recherches.',
    baseCost: { minerai: 200, silicium: 400, hydrogene: 200 },
    costFactor: 2,
    baseTime: 60,
    levelColumn: 'researchLabLevel',
    prerequisites: [],
  },
  storageMinerai: {
    id: 'storageMinerai',
    name: 'Entrepôt de minerai',
    description: 'Augmente le stockage de minerai.',
    baseCost: { minerai: 1000, silicium: 0, hydrogene: 0 },
    costFactor: 2,
    baseTime: 60,
    levelColumn: 'storageMineraiLevel',
    prerequisites: [],
  },
  storageSilicium: {
    id: 'storageSilicium',
    name: 'Entrepôt de silicium',
    description: 'Augmente le stockage de silicium.',
    baseCost: { minerai: 1000, silicium: 500, hydrogene: 0 },
    costFactor: 2,
    baseTime: 60,
    levelColumn: 'storageSiliciumLevel',
    prerequisites: [],
  },
  storageHydrogene: {
    id: 'storageHydrogene',
    name: "Réservoir d'hydrogène",
    description: "Augmente le stockage d'hydrogène.",
    baseCost: { minerai: 1000, silicium: 1000, hydrogene: 0 },
    costFactor: 2,
    baseTime: 60,
    levelColumn: 'storageHydrogeneLevel',
    prerequisites: [],
  },
};
