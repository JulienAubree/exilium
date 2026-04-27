import { BuildingsList } from './Buildings';

const RESOURCE_CATEGORY_IDS = [
  'building_extraction',
  'building_energie',
  'building_stockage',
];

export default function Resources() {
  return (
    <BuildingsList
      title="Ressources"
      categoryIds={RESOURCE_CATEGORY_IDS}
    />
  );
}
