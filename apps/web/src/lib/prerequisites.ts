import { BUILDINGS, type BuildingId, RESEARCH, type ResearchId } from '@ogame-clone/game-engine';

interface NameConfig {
  buildings?: Record<string, { name: string }>;
  research?: Record<string, { name: string }>;
}

/**
 * Resolve a missing prerequisite string like "shipyard level 7 (current: 3)"
 * into a French display name like "Chantier spatial niv. 7".
 */
export function formatMissingPrerequisite(prereq: string, config?: NameConfig): string {
  const match = prereq.match(/^(\w+) level (\d+)/);
  if (!match) return prereq;
  const [, id, level] = match;
  const buildingName = config?.buildings?.[id]?.name ?? BUILDINGS[id as BuildingId]?.name;
  if (buildingName) return `${buildingName} niv. ${level}`;
  const researchName = config?.research?.[id]?.name ?? RESEARCH[id as ResearchId]?.name;
  if (researchName) return `${researchName} niv. ${level}`;
  return prereq;
}
