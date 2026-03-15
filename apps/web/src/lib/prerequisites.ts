import { BUILDINGS, type BuildingId, RESEARCH, type ResearchId } from '@ogame-clone/game-engine';

/**
 * Resolve a missing prerequisite string like "shipyard level 7 (current: 3)"
 * into a French display name like "Chantier spatial niv. 7".
 */
export function formatMissingPrerequisite(prereq: string): string {
  const match = prereq.match(/^(\w+) level (\d+)/);
  if (!match) return prereq;
  const [, id, level] = match;
  const building = BUILDINGS[id as BuildingId];
  if (building) return `${building.name} niv. ${level}`;
  const research = RESEARCH[id as ResearchId];
  if (research) return `${research.name} niv. ${level}`;
  return prereq;
}
