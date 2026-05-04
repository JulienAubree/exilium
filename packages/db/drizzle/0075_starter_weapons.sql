-- V7.1 Starter weapons (2026-05-04)
-- Seed 3 "armes de base" par hull (1 par rareté), automatiquement attribuées
-- à tous les flagships. Stats volontairement plus faibles que les modules
-- lootables : pas de rafale, pas de chainKill — juste des dégâts secs.
-- Le player les remplace par mieux quand il loot des modules rafale/chainKill.
--
-- Convention id : `<hull>-w-starter-<rarity>` pour les distinguer en UI.

-- ── Starters Industrial ─────────────────────────────────────────────────────
INSERT INTO module_definitions (id, hull_id, rarity, kind, name, description, image, enabled, effect) VALUES
  ('indus-w-starter-common', 'industrial', 'common', 'weapon',
   'Canon de base I',
   'Arme légère intégrée. 1 tir anti-medium, dégâts modestes. Remplace-la dès que tu loot mieux.',
   '', true,
   '{"type":"weapon","profile":{"damage":5,"shots":1,"targetCategory":"medium"}}'::jsonb),
  ('indus-w-starter-rare', 'industrial', 'rare', 'weapon',
   'Canon de base II',
   'Arme moyenne intégrée. 1 tir anti-medium, dégâts standards.',
   '', true,
   '{"type":"weapon","profile":{"damage":12,"shots":1,"targetCategory":"medium"}}'::jsonb),
  ('indus-w-starter-epic', 'industrial', 'epic', 'weapon',
   'Canon de base III',
   'Arme intégrée renforcée. 2 tirs anti-medium, dégâts solides.',
   '', true,
   '{"type":"weapon","profile":{"damage":18,"shots":2,"targetCategory":"medium"}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Starters Combat ─────────────────────────────────────────────────────────
INSERT INTO module_definitions (id, hull_id, rarity, kind, name, description, image, enabled, effect) VALUES
  ('combat-w-starter-common', 'combat', 'common', 'weapon',
   'Canon militaire I',
   'Arme légère intégrée. 2 tirs anti-light, pour rester dans la mêlée.',
   '', true,
   '{"type":"weapon","profile":{"damage":4,"shots":2,"targetCategory":"light"}}'::jsonb),
  ('combat-w-starter-rare', 'combat', 'rare', 'weapon',
   'Canon militaire II',
   'Arme moyenne intégrée. 1 tir anti-medium, dégâts standards.',
   '', true,
   '{"type":"weapon","profile":{"damage":15,"shots":1,"targetCategory":"medium"}}'::jsonb),
  ('combat-w-starter-epic', 'combat', 'epic', 'weapon',
   'Canon militaire III',
   'Arme intégrée renforcée. 1 tir anti-heavy, dégâts solides.',
   '', true,
   '{"type":"weapon","profile":{"damage":35,"shots":1,"targetCategory":"heavy"}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Starters Scientific ─────────────────────────────────────────────────────
INSERT INTO module_definitions (id, hull_id, rarity, kind, name, description, image, enabled, effect) VALUES
  ('sci-w-starter-common', 'scientific', 'common', 'weapon',
   'Émetteur de base I',
   'Arme légère intégrée. 1 tir anti-light, dégâts modestes.',
   '', true,
   '{"type":"weapon","profile":{"damage":4,"shots":1,"targetCategory":"light"}}'::jsonb),
  ('sci-w-starter-rare', 'scientific', 'rare', 'weapon',
   'Émetteur de base II',
   'Arme moyenne intégrée. 2 tirs anti-light, dégâts standards.',
   '', true,
   '{"type":"weapon","profile":{"damage":7,"shots":2,"targetCategory":"light"}}'::jsonb),
  ('sci-w-starter-epic', 'scientific', 'epic', 'weapon',
   'Émetteur de base III',
   'Arme intégrée renforcée. 1 tir anti-medium, dégâts solides.',
   '', true,
   '{"type":"weapon","profile":{"damage":20,"shots":1,"targetCategory":"medium"}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Grant + auto-equip pour les flagships existants ─────────────────────────
-- Étape 1 : ajoute 1 exemplaire de chaque starter à l'inventaire du hull courant
-- de chaque flagship. Idempotent (ON CONFLICT DO NOTHING).
INSERT INTO flagship_module_inventory (flagship_id, module_id, count)
SELECT f.id, m.id, 1
FROM flagships f
JOIN module_definitions m
  ON m.hull_id = f.hull_id
 AND m.kind = 'weapon'
 AND m.id LIKE '%-w-starter-%'
ON CONFLICT (flagship_id, module_id) DO NOTHING;

-- Étape 2 : auto-équipe les starters dans les 3 slots Arsenal SI vides.
-- Stratégie : on jsonb_set le slot du hull courant avec les 3 starter ids,
-- mais SEULEMENT si le slot est null/manquant pour ne pas écraser un loadout
-- existant. La migration peut tourner plusieurs fois sans casser.
DO $$
DECLARE
  flagship_row RECORD;
  hull_id_val TEXT;
  current_slot JSONB;
  starter_common TEXT;
  starter_rare TEXT;
  starter_epic TEXT;
  new_slot JSONB;
BEGIN
  FOR flagship_row IN
    SELECT id, hull_id, module_loadout FROM flagships
  LOOP
    hull_id_val := flagship_row.hull_id;
    IF hull_id_val IS NULL THEN
      CONTINUE;
    END IF;

    -- Récupère les ids des 3 starters de ce hull
    starter_common := hull_id_val || '-w-starter-common';
    starter_rare   := hull_id_val || '-w-starter-rare';
    starter_epic   := hull_id_val || '-w-starter-epic';

    -- Vérifie que les modules existent (sinon on skip — hull custom non-seedé)
    IF NOT EXISTS (SELECT 1 FROM module_definitions WHERE id = starter_common) THEN
      CONTINUE;
    END IF;

    -- Slot actuel pour ce hull (peut être null si le hull n'a jamais été utilisé)
    current_slot := COALESCE(flagship_row.module_loadout->hull_id_val, '{}'::jsonb);

    -- Ne remplit que les slots Arsenal vides (ne touche pas aux passives ni
    -- aux weapon slots déjà occupés).
    new_slot := current_slot;
    IF (new_slot->>'weaponCommon') IS NULL THEN
      new_slot := jsonb_set(new_slot, '{weaponCommon}', to_jsonb(starter_common));
    END IF;
    IF (new_slot->>'weaponRare') IS NULL THEN
      new_slot := jsonb_set(new_slot, '{weaponRare}', to_jsonb(starter_rare));
    END IF;
    IF (new_slot->>'weaponEpic') IS NULL THEN
      new_slot := jsonb_set(new_slot, '{weaponEpic}', to_jsonb(starter_epic));
    END IF;

    -- Update si quelque chose a changé
    IF new_slot IS DISTINCT FROM current_slot THEN
      UPDATE flagships
      SET module_loadout = jsonb_set(
        COALESCE(module_loadout, '{}'::jsonb),
        ARRAY[hull_id_val],
        new_slot
      )
      WHERE id = flagship_row.id;
    END IF;
  END LOOP;
END $$;

-- Marker idempotence
INSERT INTO _migrations_state (key, value)
VALUES ('starter_weapons_init', 'done')
ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now();
