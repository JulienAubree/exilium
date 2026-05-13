import { and, eq, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { fleetPresets } from '@exilium/db';
import type { Database } from '@exilium/db';

const MAX_PRESETS_PER_USER = 20;

export type FleetPresetShips = Record<string, number>;

function sanitizeShips(input: Record<string, number>): FleetPresetShips {
  const out: FleetPresetShips = {};
  for (const [shipId, count] of Object.entries(input)) {
    if (!Number.isFinite(count) || count <= 0) continue;
    out[shipId] = Math.floor(count);
  }
  return out;
}

export function createFleetPresetService(db: Database) {
  return {
    async list(userId: string) {
      const rows = await db
        .select()
        .from(fleetPresets)
        .where(eq(fleetPresets.userId, userId))
        .orderBy(desc(fleetPresets.updatedAt));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        ships: (row.ships ?? {}) as FleetPresetShips,
        updatedAt: row.updatedAt,
      }));
    },

    async create(userId: string, name: string, ships: Record<string, number>) {
      const cleanShips = sanitizeShips(ships);
      if (Object.keys(cleanShips).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Sélectionne au moins un vaisseau avant de sauvegarder.',
        });
      }

      const existing = await db
        .select({ id: fleetPresets.id })
        .from(fleetPresets)
        .where(eq(fleetPresets.userId, userId));

      if (existing.length >= MAX_PRESETS_PER_USER) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Limite atteinte : ${MAX_PRESETS_PER_USER} presets maximum. Supprime-en un avant d'en sauvegarder un nouveau.`,
        });
      }

      const trimmed = name.trim();
      if (trimmed.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Le nom ne peut pas être vide.' });
      }

      try {
        const [row] = await db
          .insert(fleetPresets)
          .values({ userId, name: trimmed, ships: cleanShips })
          .returning();
        return { id: row.id, name: row.name, ships: cleanShips, updatedAt: row.updatedAt };
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (message.includes('fleet_presets_user_name_idx')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Un preset porte déjà ce nom. Choisis-en un autre ou écrase-le.',
          });
        }
        throw err;
      }
    },

    async update(
      userId: string,
      presetId: string,
      patch: { name?: string; ships?: Record<string, number> },
    ) {
      const [current] = await db
        .select()
        .from(fleetPresets)
        .where(and(eq(fleetPresets.id, presetId), eq(fleetPresets.userId, userId)))
        .limit(1);
      if (!current) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset introuvable.' });
      }

      const nextName = patch.name?.trim() ?? current.name;
      if (nextName.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Le nom ne peut pas être vide.' });
      }

      const nextShips = patch.ships ? sanitizeShips(patch.ships) : (current.ships as FleetPresetShips);
      if (Object.keys(nextShips).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Le preset doit contenir au moins un vaisseau.',
        });
      }

      try {
        const [row] = await db
          .update(fleetPresets)
          .set({ name: nextName, ships: nextShips, updatedAt: new Date() })
          .where(and(eq(fleetPresets.id, presetId), eq(fleetPresets.userId, userId)))
          .returning();
        return { id: row.id, name: row.name, ships: nextShips, updatedAt: row.updatedAt };
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (message.includes('fleet_presets_user_name_idx')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Un autre preset porte déjà ce nom.',
          });
        }
        throw err;
      }
    },

    async delete(userId: string, presetId: string) {
      const deleted = await db
        .delete(fleetPresets)
        .where(and(eq(fleetPresets.id, presetId), eq(fleetPresets.userId, userId)))
        .returning({ id: fleetPresets.id });
      if (deleted.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Preset introuvable.' });
      }
      return { ok: true as const };
    },
  };
}
