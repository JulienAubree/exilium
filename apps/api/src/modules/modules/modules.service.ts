import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  flagships, flagshipModuleInventory, moduleDefinitions,
} from '@exilium/db';
import type { Database } from '@exilium/db';
import { parseLoadout, getMaxCharges, type ModuleDefinitionLite } from '@exilium/game-engine';
import {
  moduleDefinitionSchema, moduleLoadoutSchema, hullSlotSchema,
  type ModuleDefinition, type ModuleLoadoutDb,
} from './modules.types.js';

type SlotType = 'epic' | 'rare' | 'common';

export function createModulesService(db: Database) {
  /** Fetch all enabled modules for use as the engine pool. Pass a transaction
   *  executor (`tx`) when called inside an equip/unequip flow so the pool is
   *  read against the same transactional snapshot — prevents races with
   *  concurrent admin disables. */
  async function getPool(executor: Database = db): Promise<ModuleDefinitionLite[]> {
    const rows = await executor.select().from(moduleDefinitions).where(eq(moduleDefinitions.enabled, true));
    return rows.map((r) => ({
      id: r.id,
      hullId: r.hullId,
      rarity: r.rarity as 'common' | 'rare' | 'epic',
      enabled: r.enabled,
      effect: r.effect as ModuleDefinitionLite['effect'],
    }));
  }

  return {
    /** Public: list of all enabled modules (for inventory display, lookups). */
    async listAll(): Promise<ModuleDefinition[]> {
      const rows = await db.select().from(moduleDefinitions).orderBy(moduleDefinitions.hullId, moduleDefinitions.rarity, moduleDefinitions.name);
      return rows.map((r) => moduleDefinitionSchema.parse(r));
    },

    /** Returns the player's inventory grouped by hull/rarity. */
    async getInventory(userId: string) {
      const [flagship] = await db.select({ id: flagships.id }).from(flagships).where(eq(flagships.userId, userId)).limit(1);
      if (!flagship) return { items: [] };
      const rows = await db.select({
        moduleId: flagshipModuleInventory.moduleId,
        count: flagshipModuleInventory.count,
        hullId: moduleDefinitions.hullId,
        rarity: moduleDefinitions.rarity,
        name: moduleDefinitions.name,
        description: moduleDefinitions.description,
        image: moduleDefinitions.image,
        enabled: moduleDefinitions.enabled,
        effect: moduleDefinitions.effect,
      })
        .from(flagshipModuleInventory)
        .innerJoin(moduleDefinitions, eq(moduleDefinitions.id, flagshipModuleInventory.moduleId))
        .where(eq(flagshipModuleInventory.flagshipId, flagship.id));
      return { items: rows };
    },

    /** Returns the loadout for a given hull. */
    async getLoadout(userId: string, hullId: string) {
      const [flagship] = await db.select({ loadout: flagships.moduleLoadout, current: flagships.epicChargesCurrent, max: flagships.epicChargesMax })
        .from(flagships).where(eq(flagships.userId, userId)).limit(1);
      if (!flagship) throw new TRPCError({ code: 'NOT_FOUND', message: 'Flagship introuvable' });
      const parsed = moduleLoadoutSchema.safeParse(flagship.loadout);
      const loadout = parsed.success ? parsed.data : {};
      return {
        hullId,
        slot: loadout[hullId as keyof typeof loadout] ?? { epic: null, rare: [], common: [] },
        epicChargesCurrent: flagship.current,
        epicChargesMax: flagship.max,
      };
    },

    /**
     * Equip a module in a slot. Validates rarity, hull, ownership,
     * not-already-equipped, not-in-mission. Atomic via transaction.
     */
    async equip(userId: string, input: { hullId: string; slotType: SlotType; slotIndex: number; moduleId: string }) {
      return await db.transaction(async (tx) => {
        const [flagship] = await tx.select().from(flagships).where(eq(flagships.userId, userId)).for('update').limit(1);
        if (!flagship) throw new TRPCError({ code: 'NOT_FOUND', message: 'Flagship introuvable' });
        if (flagship.status === 'in_mission') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Loadout verrouillé : flagship en mission' });
        }

        const [moduleDef] = await tx.select().from(moduleDefinitions).where(eq(moduleDefinitions.id, input.moduleId)).limit(1);
        if (!moduleDef || !moduleDef.enabled) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Module "${input.moduleId}" introuvable ou désactivé` });
        }
        if (moduleDef.hullId !== input.hullId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Module incompatible avec la coque ${input.hullId}` });
        }
        if (moduleDef.rarity !== input.slotType) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `Module rareté ${moduleDef.rarity} ne va pas dans slot ${input.slotType}` });
        }

        const [inv] = await tx.select({ count: flagshipModuleInventory.count }).from(flagshipModuleInventory)
          .where(and(
            eq(flagshipModuleInventory.flagshipId, flagship.id),
            eq(flagshipModuleInventory.moduleId, input.moduleId),
          )).limit(1);
        if (!inv || inv.count < 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Module non possédé' });
        }

        const loadout = (moduleLoadoutSchema.safeParse(flagship.moduleLoadout).success
          ? moduleLoadoutSchema.parse(flagship.moduleLoadout)
          : {}) as ModuleLoadoutDb;
        const slot = loadout[input.hullId as keyof ModuleLoadoutDb] ?? { epic: null, rare: [], common: [] };

        // Reject if already equipped in another slot of same hull (no double-equip even with duplicates)
        const allEquipped = [
          ...(slot.epic ? [slot.epic] : []),
          ...slot.rare,
          ...slot.common,
        ];
        if (allEquipped.includes(input.moduleId)) {
          // Allow if it's THIS exact slot being overridden (same module already there)
          const existing = input.slotType === 'epic'
            ? slot.epic
            : input.slotType === 'rare'
              ? slot.rare[input.slotIndex]
              : slot.common[input.slotIndex];
          if (existing !== input.moduleId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Module déjà équipé dans un autre slot' });
          }
        }

        // Apply slot mutation
        const newSlot = { ...slot };
        if (input.slotType === 'epic') {
          newSlot.epic = input.moduleId;
        } else if (input.slotType === 'rare') {
          if (input.slotIndex < 0 || input.slotIndex > 2) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'slotIndex doit être 0..2 pour rare' });
          }
          const rare = [...newSlot.rare];
          rare[input.slotIndex] = input.moduleId;
          newSlot.rare = rare;
        } else {
          if (input.slotIndex < 0 || input.slotIndex > 4) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'slotIndex doit être 0..4 pour common' });
          }
          const common = [...newSlot.common];
          common[input.slotIndex] = input.moduleId;
          newSlot.common = common;
        }

        const newLoadout = { ...loadout, [input.hullId]: newSlot };

        // Recompute epic_charges_max from new equipped modules
        const pool = await getPool(tx as unknown as Database);
        const equipped = parseLoadout(newLoadout, input.hullId, pool).equipped;
        const newMax = getMaxCharges(equipped);

        await tx.update(flagships).set({
          moduleLoadout: newLoadout,
          epicChargesMax: newMax,
        }).where(eq(flagships.id, flagship.id));

        return { loadout: newLoadout, epicChargesMax: newMax };
      });
    },

    /** Remove a module from a slot. */
    async unequip(userId: string, input: { hullId: string; slotType: SlotType; slotIndex: number }) {
      return await db.transaction(async (tx) => {
        const [flagship] = await tx.select().from(flagships).where(eq(flagships.userId, userId)).for('update').limit(1);
        if (!flagship) throw new TRPCError({ code: 'NOT_FOUND', message: 'Flagship introuvable' });
        if (flagship.status === 'in_mission') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Loadout verrouillé : flagship en mission' });
        }

        const loadout = (moduleLoadoutSchema.safeParse(flagship.moduleLoadout).success
          ? moduleLoadoutSchema.parse(flagship.moduleLoadout)
          : {}) as ModuleLoadoutDb;
        const slot = loadout[input.hullId as keyof ModuleLoadoutDb] ?? { epic: null, rare: [], common: [] };
        const newSlot = { ...slot };
        if (input.slotType === 'epic') {
          newSlot.epic = null;
        } else if (input.slotType === 'rare') {
          if (input.slotIndex < 0 || input.slotIndex > 2) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'slotIndex doit être 0..2 pour rare' });
          }
          const rare = [...newSlot.rare];
          delete rare[input.slotIndex];
          newSlot.rare = rare.filter((x): x is string => typeof x === 'string');
        } else {
          if (input.slotIndex < 0 || input.slotIndex > 4) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'slotIndex doit être 0..4 pour common' });
          }
          const common = [...newSlot.common];
          delete common[input.slotIndex];
          newSlot.common = common.filter((x): x is string => typeof x === 'string');
        }

        const newLoadout = { ...loadout, [input.hullId]: newSlot };
        const pool = await getPool(tx as unknown as Database);
        const equipped = parseLoadout(newLoadout, input.hullId, pool).equipped;
        const newMax = getMaxCharges(equipped);

        await tx.update(flagships).set({
          moduleLoadout: newLoadout,
          epicChargesMax: newMax,
        }).where(eq(flagships.id, flagship.id));

        return { loadout: newLoadout, epicChargesMax: newMax };
      });
    },

    /**
     * Roll a per-combat module drop for a flagship after a combat win.
     * Returns the granted module id (with hull side info) or null.
     * Caller is responsible for inserting into flagship_module_inventory.
     *
     * Pass `executor` (a tx) when called inside an anomaly transaction so the
     * pool is read against the same snapshot — prevents racing with an admin
     * disable mid-combat.
     */
    async rollPerCombatDrop(args: { flagshipHullId: string; rng?: () => number; executor?: Database }): Promise<string | null> {
      const rng = args.rng ?? Math.random;
      const roll = rng();
      const pool = await getPool(args.executor ?? db);
      const otherHulls = ['combat', 'scientific', 'industrial'].filter((h) => h !== args.flagshipHullId);

      if (roll < 0.30) {
        // 30% : commun de la coque du flagship
        const candidates = pool.filter((m) => m.hullId === args.flagshipHullId && m.rarity === 'common');
        if (candidates.length === 0) return null;
        return candidates[Math.floor(rng() * candidates.length)].id;
      } else if (roll < 0.35) {
        // 5% : commun d'une autre coque (uniforme parmi les 2 autres)
        const otherHull = otherHulls[Math.floor(rng() * otherHulls.length)];
        const candidates = pool.filter((m) => m.hullId === otherHull && m.rarity === 'common');
        if (candidates.length === 0) return null;
        return candidates[Math.floor(rng() * candidates.length)].id;
      }
      // 65% : rien
      return null;
    },

    /**
     * Roll the per-run final drop based on depth reached. Returns array of
     * granted module ids (could be empty). Caller inserts to inventory.
     *
     * Pass `executor` (a tx) when called inside an anomaly transaction so the
     * pool is read against the same snapshot.
     */
    async rollPerRunFinalDrop(args: { flagshipHullId: string; depth: number; rng?: () => number; executor?: Database }): Promise<string[]> {
      const rng = args.rng ?? Math.random;
      const pool = await getPool(args.executor ?? db);
      const own = (rarity: 'common' | 'rare' | 'epic') => pool.filter((m) => m.hullId === args.flagshipHullId && m.rarity === rarity);

      const out: string[] = [];
      const drawOne = (rarity: 'common' | 'rare' | 'epic') => {
        const cands = own(rarity);
        if (cands.length > 0) out.push(cands[Math.floor(rng() * cands.length)].id);
      };

      if (args.depth >= 13) {
        drawOne('rare');
        drawOne('epic');
      } else if (args.depth >= 8) {
        drawOne('rare');
        if (rng() < 0.30) drawOne('epic');
      } else if (args.depth >= 4) {
        drawOne('rare');
      } else if (args.depth >= 1) {
        drawOne('common');
      }
      return out;
    },

    /**
     * Insert (or count++) a module in a flagship's inventory.
     *
     * Pass `executor` (a tx) when called inside a transaction so the write
     * commits/rolls back atomically with the surrounding anomaly mutation.
     * Without it, a tx rollback (e.g. CONFLICT WHERE-guard) would leave the
     * inventory write committed → duplicate-drop exploit.
     */
    async grantModule(flagshipId: string, moduleId: string, executor: Database = db) {
      await executor.insert(flagshipModuleInventory).values({
        flagshipId, moduleId, count: 1,
      }).onConflictDoUpdate({
        target: [flagshipModuleInventory.flagshipId, flagshipModuleInventory.moduleId],
        set: { count: sql`${flagshipModuleInventory.count} + 1` },
      });
    },

    /**
     * Admin: upsert a module definition. Validates Zod, replaces enabled state.
     */
    async adminUpsert(input: ModuleDefinition) {
      const parsed = moduleDefinitionSchema.parse(input);
      await db.insert(moduleDefinitions).values(parsed).onConflictDoUpdate({
        target: moduleDefinitions.id,
        set: {
          hullId: parsed.hullId,
          rarity: parsed.rarity,
          name: parsed.name,
          description: parsed.description,
          image: parsed.image,
          enabled: parsed.enabled,
          effect: parsed.effect,
        },
      });
      return parsed;
    },

    async adminDelete(id: string) {
      await db.delete(moduleDefinitions).where(eq(moduleDefinitions.id, id));
    },

    /** Internal helper for tests + scripts. */
    _getPool: getPool,
    _SLOT_TYPES: ['epic', 'rare', 'common'] as const,
  };
}

export type ModulesService = ReturnType<typeof createModulesService>;
export { hullSlotSchema };
