/**
 * Types partagés des cartes d'infrastructure.
 *
 * `BuildingForCard` vivait auparavant dans `components/resources/ResourceCard.tsx`.
 * Ce composant faisait partie des pages Énergie et Ressources, fusionnées dans
 * l'Overview — mais son type restait importé par `InfrastructureCard`, ce qui
 * empêchait de supprimer le fichier. Le type vit désormais ici, à côté de son
 * unique consommateur.
 */

export type BuildingPrereq = {
  buildingId: string;
  level: number;
  currentLevel?: number;
};

export interface BuildingForCard {
  id: string;
  currentLevel: number;
  maxLevel: number | null;
  nextLevelCost: { minerai: number; silicium: number; hydrogene: number };
  nextLevelTime: number;
  prerequisites: BuildingPrereq[];
  isUpgrading: boolean;
  upgradeEndTime: string | null;
}
