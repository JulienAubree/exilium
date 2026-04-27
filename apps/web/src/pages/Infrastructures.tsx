import { BuildingsList } from './Buildings';

const INFRASTRUCTURE_CATEGORY_IDS = [
  'building_industrie',
  'building_recherche',
  'building_exploration',
  'building_commerce',
  'building_gouvernance',
  'building_defense',
];

// shipyard, arsenal et commandCenter ont leurs propres pages (Chantier spatial,
// Défense, Centre de commandement) — on les exclut de la liste générique.
const EXCLUDED_BUILDINGS = ['shipyard', 'arsenal', 'commandCenter'];

export default function Infrastructures() {
  return (
    <BuildingsList
      title="Infrastructures"
      categoryIds={INFRASTRUCTURE_CATEGORY_IDS}
      excludeBuildingIds={EXCLUDED_BUILDINGS}
    />
  );
}
