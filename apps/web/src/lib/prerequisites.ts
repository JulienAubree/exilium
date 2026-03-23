import { getEntityName } from './entity-names';

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
  return `${getEntityName(id, config)} niv. ${level}`;
}
