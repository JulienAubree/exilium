import { z } from 'zod';
import type { StatKey, TriggerKey, AbilityKey } from '@exilium/game-engine';

const STAT_KEYS = ['damage', 'hull', 'shield', 'armor', 'cargo', 'speed', 'regen', 'epic_charges_max'] as const satisfies readonly StatKey[];
const TRIGGER_KEYS = ['first_round', 'low_hull', 'enemy_fp_above'] as const satisfies readonly TriggerKey[];
const ABILITY_KEYS = ['repair', 'shield_burst', 'overcharge', 'scan', 'skip', 'damage_burst'] as const satisfies readonly AbilityKey[];

const HULL_IDS = ['combat', 'scientific', 'industrial'] as const;
const RARITIES = ['common', 'rare', 'epic'] as const;

export const moduleEffectSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stat'),
    stat: z.enum(STAT_KEYS),
    value: z.number(),
  }),
  z.object({
    type: z.literal('conditional'),
    trigger: z.enum(TRIGGER_KEYS),
    threshold: z.number().optional(),
    effect: z.object({
      stat: z.enum(STAT_KEYS),
      value: z.number(),
    }),
  }),
  z.object({
    type: z.literal('active'),
    ability: z.enum(ABILITY_KEYS),
    magnitude: z.number(),
  }),
]);

export const moduleDefinitionSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
  hullId: z.enum(HULL_IDS),
  rarity: z.enum(RARITIES),
  name: z.string().min(1).max(80),
  description: z.string().min(1),
  image: z.string().max(500).default(''),
  enabled: z.boolean().default(true),
  effect: moduleEffectSchema,
});

export type ModuleDefinitionInput = z.input<typeof moduleDefinitionSchema>;
export type ModuleDefinition = z.infer<typeof moduleDefinitionSchema>;

export const HULL_LIST = HULL_IDS;
export const RARITY_LIST = RARITIES;

// Loadout shape persisted on flagships.module_loadout.
//
// `rare` and `common` are FIXED-LENGTH arrays where empty slots are stored as
// explicit `null` placeholders. This avoids a sparse-array trap : assigning
// `arr[2] = "id"` on an empty array produces `[<empty>, <empty>, "id"]` which
// `JSON.stringify` serialises to `[null, null, "id"]` — the original Zod
// schema (`z.array(z.string())`) then rejected the parsed value, silently
// wiping the loadout on read. We now enforce explicit nulls on write AND
// pad on parse for legacy rows that were stored without padding.
export const hullSlotSchema = z.object({
  epic:   z.string().nullable(),
  rare:   z.array(z.string().nullable()).length(3),
  common: z.array(z.string().nullable()).length(5),
});

export const moduleLoadoutSchema = z.object({
  combat:     hullSlotSchema.optional(),
  scientific: hullSlotSchema.optional(),
  industrial: hullSlotSchema.optional(),
});

export type ModuleLoadoutDb = z.infer<typeof moduleLoadoutSchema>;
