export function eventTypeColor(type: string) {
  switch (type) {
    case 'building-done': return 'bg-primary';
    case 'research-done': return 'bg-violet-500';
    case 'shipyard-done': return 'bg-orange-500';
    case 'fleet-arrived': return 'bg-blue-500';
    case 'fleet-returned': return 'bg-emerald-500';
    case 'pve-mission-done': return 'bg-amber-500';
    case 'tutorial-quest-done': return 'bg-cyan-500';
    default: return 'bg-muted';
  }
}

export function eventTypeLabel(type: string) {
  switch (type) {
    case 'building-done': return 'Construction';
    case 'research-done': return 'Recherche';
    case 'shipyard-done': return 'Chantier';
    case 'fleet-arrived': return 'Flotte arrivée';
    case 'fleet-returned': return 'Flotte de retour';
    case 'pve-mission-done': return 'Mission PvE';
    case 'tutorial-quest-done': return 'Tutoriel';
    default: return 'Événement';
  }
}

import { getEntityName } from './entity-names';

const MISSION_LABELS: Record<string, string> = {
  transport: 'Transport',
  station: 'Stationnement',
  spy: 'Espionnage',
  attack: 'Attaque',
  colonize: 'Colonisation',
  recycle: 'Recyclage',
  mine: 'Minage',
  pirate: 'Pirate',
};

export function formatEventText(event: { type: string; payload?: unknown }, options?: { includePlanet?: boolean }) {
  const p = event.payload as any;
  const planet = options?.includePlanet && p.planetName ? ` sur ${p.planetName}` : '';
  switch (event.type) {
    case 'building-done': return `${p.name ?? getEntityName(p.buildingId)} niveau ${p.level}${planet}`;
    case 'research-done': return `${p.name ?? getEntityName(p.techId)} niveau ${p.level}${planet}`;
    case 'shipyard-done': return `${p.count}x ${p.name ?? getEntityName(p.unitId)}${planet}`;
    case 'fleet-arrived': return `Mission ${MISSION_LABELS[p.mission] ?? p.mission} arrivée en ${p.targetCoords}`;
    case 'fleet-returned': return `Flotte rentrée sur ${p.originName}`;
    case 'pve-mission-done': {
      const mLabel = p.missionType === 'pirate' ? 'Pirate' : 'Minage';
      const loot = [
        p.cargo?.minerai ? `${p.cargo.minerai.toLocaleString('fr-FR')} minerai` : '',
        p.cargo?.silicium ? `${p.cargo.silicium.toLocaleString('fr-FR')} silicium` : '',
        p.cargo?.hydrogene ? `${p.cargo.hydrogene.toLocaleString('fr-FR')} hydrogène` : '',
      ].filter(Boolean).join(', ');
      return `${mLabel} en ${p.targetCoords}${loot ? ` — ${loot}` : ''}`;
    }
    case 'tutorial-quest-done': return `Quête "${p.questTitle}" terminée`;
    default: return 'Événement';
  }
}

export function formatRelativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export function formatDateTime(date: string) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Group consecutive shipyard-done events with the same unitId + planetId,
 * summing their counts. Prevents notification/event flood when building
 * multiple units of the same type one by one.
 */
export function groupEvents<T extends { type: string; payload?: any; planetId?: string | null }>(events: T[]): T[] {
  const result: T[] = [];

  for (const event of events) {
    const last = result[result.length - 1];

    if (
      last &&
      last.type === 'shipyard-done' &&
      event.type === 'shipyard-done' &&
      (last.payload as any)?.unitId === (event.payload as any)?.unitId &&
      last.planetId === event.planetId
    ) {
      const lastPayload = last.payload as any;
      const eventPayload = event.payload as any;
      result[result.length - 1] = {
        ...last,
        payload: {
          ...lastPayload,
          count: (lastPayload.count ?? 1) + (eventPayload.count ?? 1),
        },
      };
    } else {
      result.push({ ...event });
    }
  }

  return result;
}

export function eventNavigationTarget(type: string): string {
  switch (type) {
    case 'building-done': return '/buildings';
    case 'research-done': return '/research';
    case 'shipyard-done': return '/shipyard';
    case 'fleet-arrived':
    case 'fleet-returned': return '/movements';
    case 'pve-mission-done': return '/missions';
    case 'tutorial-quest-done': return '/';
    default: return '/';
  }
}
