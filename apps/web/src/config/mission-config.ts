import { MissionType } from '@exilium/shared';

export type Mission = `${MissionType}`;

export type ShipCategory = 'required' | 'optional' | 'disabled';

interface MissionDef {
  dangerous: boolean;
  requiredShipRoles: string[] | null;
  exclusive: boolean;
  recommendedShipRoles: string[] | null;
  requiresPveMission: boolean;
}

export function getCargoCapacity(
  selectedShips: Record<string, number>,
  shipConfigs: Record<string, { cargoCapacity: number }>,
): number {
  return Object.entries(selectedShips).reduce((sum, [id, count]) => {
    const stats = shipConfigs[id];
    return sum + (stats ? stats.cargoCapacity * count : 0);
  }, 0);
}

export function categorizeShip(
  shipId: string,
  shipCount: number,
  missionDef: MissionDef | undefined,
  shipConfig?: { isStationary?: boolean; role?: string | null; unlockedMissions?: string[] },
  missionId?: string,
): ShipCategory {
  if (shipConfig?.isStationary) return 'disabled';
  if (!missionDef) return 'disabled';
  if (shipCount === 0) return 'disabled';

  // Flagship: check hull-unlocked missions, otherwise optional companion
  if (shipId === 'flagship') {
    if (missionId && shipConfig?.unlockedMissions?.length && shipConfig.unlockedMissions.includes(missionId)) {
      return 'required';
    }
    return 'optional';
  }

  const matchesRequired = missionDef.requiredShipRoles?.some(
    (r) => r === shipId || (shipConfig?.role && r === shipConfig.role),
  );
  const matchesRecommended = missionDef.recommendedShipRoles?.some(
    (r) => r === shipId || (shipConfig?.role && r === shipConfig.role),
  );

  if (missionDef.exclusive && missionDef.requiredShipRoles) {
    return matchesRequired ? 'required' : 'disabled';
  }

  if (matchesRequired) return 'required';
  if (matchesRecommended) return 'required';

  return 'optional';
}
