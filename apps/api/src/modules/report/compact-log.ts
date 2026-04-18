/**
 * Compress/decompress DetailedCombatLog for DB storage.
 *
 * v1 compact format vs verbose format:
 * - Short keys (shooterId → si, targetType → tt, …)
 * - Floats rounded to integers
 * - Zero/false values omitted
 * - `damage` field removed (= sa + ab + hd)
 * - Per-round snapshots store only (id, shield, hull); unitType/side derived from initialUnits
 *
 * ~55% size reduction. Old reports (no `v` field) are passed through as-is.
 */

// ── Compact types (stored in DB) ──

interface CompactEvent {
  r: number;       // round
  si: string;      // shooterId
  st: string;      // shooterType
  ti: string;      // targetId
  tt: string;      // targetType
  sa?: number;     // shieldAbsorbed (omitted if 0)
  ab?: number;     // armorBlocked (omitted if 0)
  hd?: number;     // hullDamage (omitted if 0)
  k?: 1;           // targetDestroyed (omitted if false)
}

interface CompactSnapshot {
  i: string;       // unitId
  s: number;       // shield (rounded)
  h: number;       // hull (rounded)
}

interface CompactInitUnit {
  i: string;       // unitId
  t: string;       // unitType
  d: 0 | 1;        // side: 0=attacker, 1=defender
  s: number;       // shield (rounded)
  h: number;       // hull (rounded)
}

interface CompactDetailedLog {
  v: 1;
  e: CompactEvent[];
  s: CompactSnapshot[][];
  u: CompactInitUnit[];
}

// ── Verbose types (used by engine & frontend) ──

interface CombatEvent {
  round: number;
  shooterId: string;
  shooterType: string;
  targetId: string;
  targetType: string;
  damage: number;
  shieldAbsorbed: number;
  armorBlocked: number;
  hullDamage: number;
  targetDestroyed: boolean;
}

interface UnitSnapshot {
  unitId: string;
  unitType: string;
  side: 'attacker' | 'defender';
  shield: number;
  hull: number;
  destroyed: boolean;
}

export interface DetailedCombatLog {
  events: CombatEvent[];
  snapshots: UnitSnapshot[][];
  initialUnits: UnitSnapshot[];
}

// ── Compress (before DB write) ──

export function compressDetailedLog(log: Record<string, unknown>): CompactDetailedLog {
  const full = log as unknown as DetailedCombatLog;
  return {
    v: 1,
    e: full.events.map((e) => {
      const ce: CompactEvent = {
        r: e.round,
        si: e.shooterId,
        st: e.shooterType,
        ti: e.targetId,
        tt: e.targetType,
      };
      if (e.shieldAbsorbed > 0) ce.sa = Math.round(e.shieldAbsorbed);
      if (e.armorBlocked > 0) ce.ab = Math.round(e.armorBlocked);
      if (e.hullDamage > 0) ce.hd = Math.round(e.hullDamage);
      if (e.targetDestroyed) ce.k = 1;
      return ce;
    }),
    s: full.snapshots.map((round) =>
      round.map((snap) => ({
        i: snap.unitId,
        s: Math.round(snap.shield),
        h: Math.round(snap.hull),
      })),
    ),
    u: full.initialUnits.map((u) => ({
      i: u.unitId,
      t: u.unitType,
      d: (u.side === 'attacker' ? 0 : 1) as 0 | 1,
      s: Math.round(u.shield),
      h: Math.round(u.hull),
    })),
  };
}

// ── Decompress (after DB read) ──

export function decompressDetailedLog(data: unknown): DetailedCombatLog | null {
  if (!data || typeof data !== 'object') return null;

  // Old verbose format: pass through as-is
  if (!('v' in (data as Record<string, unknown>))) return data as DetailedCombatLog;

  const compact = data as CompactDetailedLog;

  // Build lookup from initialUnits for per-round snapshot expansion
  const unitInfo = new Map<string, { unitType: string; side: 'attacker' | 'defender' }>();
  const initialUnits: UnitSnapshot[] = compact.u.map((u) => {
    const side: 'attacker' | 'defender' = u.d === 0 ? 'attacker' : 'defender';
    unitInfo.set(u.i, { unitType: u.t, side });
    return {
      unitId: u.i,
      unitType: u.t,
      side,
      shield: u.s,
      hull: u.h,
      destroyed: false,
    };
  });

  const events: CombatEvent[] = compact.e.map((e) => ({
    round: e.r,
    shooterId: e.si,
    shooterType: e.st,
    targetId: e.ti,
    targetType: e.tt,
    damage: (e.sa ?? 0) + (e.ab ?? 0) + (e.hd ?? 0),
    shieldAbsorbed: e.sa ?? 0,
    armorBlocked: e.ab ?? 0,
    hullDamage: e.hd ?? 0,
    targetDestroyed: e.k === 1,
  }));

  const snapshots: UnitSnapshot[][] = compact.s.map((round) =>
    round.map((snap) => {
      const info = unitInfo.get(snap.i);
      return {
        unitId: snap.i,
        unitType: info?.unitType ?? '',
        side: info?.side ?? 'attacker',
        shield: snap.s,
        hull: snap.h,
        destroyed: snap.h <= 0,
      };
    }),
  );

  return { events, snapshots, initialUnits };
}
