/**
 * Centralized name resolver — never returns a raw ID.
 * Priority: gameConfig (DB) > humanized ID.
 */

interface GameConfigLike {
  buildings?: Record<string, { name: string }>;
  research?: Record<string, { name: string }>;
  ships?: Record<string, { name: string }>;
  defenses?: Record<string, { name: string }>;
}

function humanize(id: string): string {
  return id.replace(/([A-Z])/g, ' $1').trim();
}

export function getBuildingName(id: string, config?: GameConfigLike | null): string {
  return config?.buildings?.[id]?.name ?? humanize(id);
}

export function getResearchName(id: string, config?: GameConfigLike | null): string {
  return config?.research?.[id]?.name ?? humanize(id);
}

export function getShipName(id: string, config?: GameConfigLike | null): string {
  return config?.ships?.[id]?.name ?? humanize(id);
}

export function getDefenseName(id: string, config?: GameConfigLike | null): string {
  return config?.defenses?.[id]?.name ?? humanize(id);
}

export function getUnitName(id: string, config?: GameConfigLike | null): string {
  return config?.ships?.[id]?.name
    ?? config?.defenses?.[id]?.name
    ?? humanize(id);
}

export function getEntityName(id: string, config?: GameConfigLike | null): string {
  return config?.buildings?.[id]?.name
    ?? config?.research?.[id]?.name
    ?? config?.ships?.[id]?.name
    ?? config?.defenses?.[id]?.name
    ?? humanize(id);
}
