import { getUnitName } from '@/lib/entity-names';

const fmt = (n: number) => Math.floor(n).toLocaleString('fr-FR');

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

interface ShotGroup {
  shooterType: string;
  targetType: string;
  shotCount: number;
  totalDamage: number;
  shieldAbsorbed: number;
  hullDamage: number;
  kills: number;
}

interface RoundShotDetailProps {
  events: CombatEvent[];
  round: number;
  unitSideMap: Map<string, 'attacker' | 'defender'>;
  gameConfig: any;
  perspective?: 'attacker' | 'defender';
}

function aggregateShots(
  events: CombatEvent[],
  round: number,
  unitSideMap: Map<string, 'attacker' | 'defender'>,
): { attacker: ShotGroup[]; defender: ShotGroup[] } {
  const roundEvents = events.filter((e) => e.round === round);

  const groups: Record<string, ShotGroup & { side: 'attacker' | 'defender' }> = {};

  for (const e of roundEvents) {
    const side = unitSideMap.get(e.shooterId) ?? 'attacker';
    const key = `${side}:${e.shooterType}:${e.targetType}`;
    if (!groups[key]) {
      groups[key] = {
        side,
        shooterType: e.shooterType,
        targetType: e.targetType,
        shotCount: 0,
        totalDamage: 0,
        shieldAbsorbed: 0,
        hullDamage: 0,
        kills: 0,
      };
    }
    const g = groups[key];
    g.shotCount += 1;
    g.totalDamage += e.damage;
    g.shieldAbsorbed += e.shieldAbsorbed;
    g.hullDamage += e.hullDamage;
    if (e.targetDestroyed) g.kills += 1;
  }

  const all = Object.values(groups);
  const attacker = all
    .filter((g) => g.side === 'attacker')
    .sort((a, b) => b.totalDamage - a.totalDamage);
  const defender = all
    .filter((g) => g.side === 'defender')
    .sort((a, b) => b.totalDamage - a.totalDamage);

  return { attacker, defender };
}

function ShotGroupRow({ group, gameConfig }: { group: ShotGroup; gameConfig: any }) {
  const shooterName = getUnitName(group.shooterType, gameConfig);
  const targetName = getUnitName(group.targetType, gameConfig);
  const maxDmg = Math.max(group.shieldAbsorbed, group.hullDamage, 1);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-foreground font-medium truncate">{shooterName}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground shrink-0"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
        <span className="text-foreground font-medium truncate">{targetName}</span>
        <span className="text-muted-foreground ml-auto shrink-0">
          {group.shotCount} tir{group.shotCount > 1 ? 's' : ''}
        </span>
      </div>
      {/* Damage bars */}
      <div className="flex gap-1 h-1.5">
        {group.shieldAbsorbed > 0 && (
          <div
            className="rounded-full bg-cyan-500/60"
            style={{ flex: group.shieldAbsorbed / maxDmg }}
            title={`Bouclier : ${fmt(group.shieldAbsorbed)}`}
          />
        )}
        {group.hullDamage > 0 && (
          <div
            className="rounded-full bg-orange-500/60"
            style={{ flex: group.hullDamage / maxDmg }}
            title={`Coque : ${fmt(group.hullDamage)}`}
          />
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        {group.shieldAbsorbed > 0 && (
          <span className="text-cyan-400/80">{fmt(group.shieldAbsorbed)} bouclier</span>
        )}
        {group.hullDamage > 0 && (
          <span className="text-orange-400/80">{fmt(group.hullDamage)} coque</span>
        )}
        {group.kills > 0 && (
          <span className="text-red-400">
            {group.kills} detruit{group.kills > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export function RoundShotDetail({
  events,
  round,
  unitSideMap,
  gameConfig,
  perspective,
}: RoundShotDetailProps) {
  const { attacker, defender } = aggregateShots(events, round, unitSideMap);

  if (attacker.length === 0 && defender.length === 0) return null;

  const isDefPerspective = perspective === 'defender';
  const leftGroups = isDefPerspective ? defender : attacker;
  const rightGroups = isDefPerspective ? attacker : defender;
  const leftLabel = isDefPerspective ? 'Vos tirs' : 'Tirs attaquant';
  const rightLabel = isDefPerspective ? 'Tirs ennemi' : 'Tirs defenseur';

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">
          {leftLabel}
        </div>
        {leftGroups.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/60">Aucun tir</div>
        ) : (
          leftGroups.map((g) => (
            <ShotGroupRow
              key={`${g.shooterType}-${g.targetType}`}
              group={g}
              gameConfig={gameConfig}
            />
          ))
        )}
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold">
          {rightLabel}
        </div>
        {rightGroups.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/60">Aucun tir</div>
        ) : (
          rightGroups.map((g) => (
            <ShotGroupRow
              key={`${g.shooterType}-${g.targetType}`}
              group={g}
              gameConfig={gameConfig}
            />
          ))
        )}
      </div>
    </div>
  );
}
