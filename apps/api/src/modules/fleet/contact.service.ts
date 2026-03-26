import { eq, and, inArray, asc } from 'drizzle-orm';
import { planets } from '@ogame-clone/db';
import type { Database } from '@ogame-clone/db';
import type { createFriendService } from '../friend/friend.service.js';
import type { createAllianceService } from '../alliance/alliance.service.js';

export interface ContactPlanet {
  name: string;
  galaxy: number;
  system: number;
  position: number;
}

export function createContactService(
  db: Database,
  friendService: ReturnType<typeof createFriendService>,
  allianceService: ReturnType<typeof createAllianceService>,
) {
  async function getPlanetsByUserIds(userIds: string[]): Promise<Map<string, ContactPlanet[]>> {
    if (userIds.length === 0) return new Map();
    const rows = await db
      .select({
        userId: planets.userId,
        name: planets.name,
        galaxy: planets.galaxy,
        system: planets.system,
        position: planets.position,
      })
      .from(planets)
      .where(and(
        inArray(planets.userId, userIds),
        eq(planets.planetType, 'planet'),
      ))
      .orderBy(asc(planets.createdAt));

    const map = new Map<string, ContactPlanet[]>();
    for (const row of rows) {
      const list = map.get(row.userId) ?? [];
      list.push({ name: row.name, galaxy: row.galaxy, system: row.system, position: row.position });
      map.set(row.userId, list);
    }
    return map;
  }

  return {
    async getContacts(userId: string) {
      // 1. Own planets
      const myPlanets = await db
        .select({
          id: planets.id,
          name: planets.name,
          galaxy: planets.galaxy,
          system: planets.system,
          position: planets.position,
        })
        .from(planets)
        .where(and(eq(planets.userId, userId), eq(planets.planetType, 'planet')))
        .orderBy(asc(planets.createdAt));

      // 2. Friends
      const friendList = await friendService.list(userId);
      const friendUserIds = friendList.map((f) => f.userId);
      const friendPlanetsMap = await getPlanetsByUserIds(friendUserIds);

      const friends = friendList
        .map((f) => ({
          userId: f.userId,
          username: f.username,
          planets: friendPlanetsMap.get(f.userId) ?? [],
        }))
        .filter((f) => f.planets.length > 0)
        .sort((a, b) => a.username.localeCompare(b.username));

      // 3. Alliance members (deduplicate: exclude self and friends)
      const friendUserIdSet = new Set(friendUserIds);
      const allianceData = await allianceService.myAlliance(userId);
      let allianceTag: string | null = null;
      let allianceMembers: { userId: string; username: string; role: string; planets: ContactPlanet[] }[] = [];

      if (allianceData) {
        allianceTag = allianceData.tag;
        const otherMembers = allianceData.members.filter(
          (m) => m.userId !== userId && !friendUserIdSet.has(m.userId),
        );
        const allianceUserIds = otherMembers.map((m) => m.userId);
        const alliancePlanetsMap = await getPlanetsByUserIds(allianceUserIds);

        allianceMembers = otherMembers
          .map((m) => ({
            userId: m.userId,
            username: m.username,
            role: m.role,
            planets: alliancePlanetsMap.get(m.userId) ?? [],
          }))
          .filter((m) => m.planets.length > 0)
          .sort((a, b) => a.username.localeCompare(b.username));
      }

      return { myPlanets, friends, allianceMembers, allianceTag };
    },
  };
}
