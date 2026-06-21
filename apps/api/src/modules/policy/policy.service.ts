import { TRPCError } from '@trpc/server';
import { byUser } from '../../lib/db-helpers.js';
import { empirePolicies, empireProgression } from '@exilium/db';
import {
  POLICY_AXES,
  policyEffects,
  empirePolicyCapacity,
  countActivePolicies,
  isPolicyAxis,
  isPolicyPosture,
} from '@exilium/game-engine';
import type { Database } from '@exilium/db';
import type { GameConfigService } from '../admin/game-config.service.js';

type ActiveMap = Record<string, string>;
type SwitchedMap = Record<string, string>;

export function createPolicyService(db: Database, gameConfigService: GameConfigService) {
  async function load(userId: string): Promise<{ active: ActiveMap; switchedAt: SwitchedMap }> {
    const [row] = await db
      .select({ active: empirePolicies.active, switchedAt: empirePolicies.switchedAt })
      .from(empirePolicies)
      .where(byUser(empirePolicies.userId, userId))
      .limit(1);
    return {
      active: (row?.active as ActiveMap) ?? {},
      switchedAt: (row?.switchedAt as SwitchedMap) ?? {},
    };
  }

  async function empireLevel(userId: string): Promise<number> {
    const [row] = await db
      .select({ level: empireProgression.level })
      .from(empireProgression)
      .where(byUser(empireProgression.userId, userId))
      .limit(1);
    return row?.level ?? 1;
  }

  async function getState(userId: string) {
    const config = await gameConfigService.getFullConfig();
    const { active, switchedAt } = await load(userId);
    const level = await empireLevel(userId);
    const capacity = empirePolicyCapacity(level, config.universe);
    const cooldownHours = Number(config.universe.policy_switch_cooldown_hours) || 12;
    const cooldownMs = cooldownHours * 3600 * 1000;
    const now = Date.now();

    // Pour chaque axe : à quand le prochain changement autorisé (null si dispo).
    const nextSwitchAt: Record<string, string | null> = {};
    for (const axis of POLICY_AXES) {
      const ts = switchedAt[axis.id] ? Date.parse(switchedAt[axis.id]) : 0;
      const next = ts + cooldownMs;
      nextSwitchAt[axis.id] = ts && next > now ? new Date(next).toISOString() : null;
    }

    return {
      axes: POLICY_AXES,
      active,
      used: countActivePolicies(active),
      capacity,
      empireLevel: level,
      cooldownHours,
      nextSwitchAt,
      effects: policyEffects(active),
    };
  }

  /** Change la posture d'un axe. `posture` null ou 'neutre' = retour au neutre. */
  async function setPosture(userId: string, axis: string, posture: string | null) {
    if (!isPolicyAxis(axis)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Axe de politique inconnu.' });
    }
    const clearing = posture == null || posture === 'neutre';
    if (!clearing && !isPolicyPosture(axis, posture)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Posture inconnue pour cet axe.' });
    }

    const config = await gameConfigService.getFullConfig();
    const { active, switchedAt } = await load(userId);

    // No-op : la posture demandée est déjà en vigueur.
    const current = active[axis] ?? null;
    if ((clearing && current === null) || (!clearing && current === posture)) {
      return getState(userId);
    }

    // Cooldown par axe (ne bloque pas un retour au neutre — désengager est gratuit).
    if (!clearing && switchedAt[axis]) {
      const cooldownMs = (Number(config.universe.policy_switch_cooldown_hours) || 12) * 3600 * 1000;
      const next = Date.parse(switchedAt[axis]) + cooldownMs;
      if (next > Date.now()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cet axe est en cooldown jusqu'au ${new Date(next).toLocaleString('fr-FR')}.`,
        });
      }
    }

    const nextActive: ActiveMap = { ...active };
    if (clearing) delete nextActive[axis];
    else nextActive[axis] = posture;

    // Capacité : le nombre de postures non-neutres ne doit pas dépasser le cap.
    if (!clearing) {
      const level = await empireLevel(userId);
      const capacity = empirePolicyCapacity(level, config.universe);
      if (countActivePolicies(nextActive) > capacity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Capacité de politiques atteinte (${capacity}). Désactive un axe ou monte ton niveau d'empire.`,
        });
      }
    }

    const nextSwitched: SwitchedMap = { ...switchedAt };
    if (clearing) delete nextSwitched[axis];
    else nextSwitched[axis] = new Date().toISOString();

    await db
      .insert(empirePolicies)
      .values({ userId, active: nextActive, switchedAt: nextSwitched, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: empirePolicies.userId,
        set: { active: nextActive, switchedAt: nextSwitched, updatedAt: new Date() },
      });

    return getState(userId);
  }

  return { getState, setPosture };
}
