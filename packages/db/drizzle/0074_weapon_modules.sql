-- V7-WeaponProfiles (2026-05-04)
-- Ajoute la notion de "kind" sur les module definitions :
--   'passive' (défaut, comportement V1) : modules à effet stat/conditional/active
--   'weapon'  (V7) : modules qui apportent un weaponProfile au flagship pendant le combat
--
-- Les weapon modules s'équipent dans 3 nouveaux slots du moduleLoadout :
--   weaponCommon (1 slot), weaponRare (1 slot), weaponEpic (1 slot)
-- Le moduleLoadout reste un jsonb sans changement de schéma — la convention
-- est juste étendue côté code (parseLoadout, modules service).

ALTER TABLE module_definitions
  ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'passive';

-- Index utile : trouver rapidement les weapon modules d'un hull/rareté
CREATE INDEX IF NOT EXISTS idx_modules_hull_rarity_kind
  ON module_definitions(hull_id, rarity, kind)
  WHERE enabled = true;

-- ── Pool initial de weapon modules (V7) ─────────────────────────────────────
-- Convention effect : { type: 'weapon', profile: { damage, shots, targetCategory, rafale?, hasChainKill? } }
-- 3 hulls × 3 raretés × 1-2 variantes = ~9-12 modules pour démarrer.

-- Industrial (le hull "neutre" — armes utilitaires, pas de spécialisation)
INSERT INTO module_definitions (id, hull_id, rarity, kind, name, description, image, enabled, effect) VALUES
  ('indus-w-light-turret',  'industrial', 'common', 'weapon',
   'Tourelle légère',
   'Petite tourelle anti-chasseurs. 2 tirs anti-light, damage faible.',
   '', true,
   '{"type":"weapon","profile":{"damage":12,"shots":2,"targetCategory":"light"}}'::jsonb),
  ('indus-w-rafale-cannon', 'industrial', 'rare',   'weapon',
   'Lance-canons rafale',
   'Pose 1 tir anti-medium puis rafale ×2 si la cible est medium.',
   '', true,
   '{"type":"weapon","profile":{"damage":30,"shots":1,"targetCategory":"medium","rafale":{"category":"medium","count":2}}}'::jsonb),
  ('indus-w-thermal-salvo', 'industrial', 'epic',   'weapon',
   'Salve thermique',
   '2 tirs anti-medium avec chaîne de kill : chaque cible détruite déclenche un tir bonus.',
   '', true,
   '{"type":"weapon","profile":{"damage":60,"shots":2,"targetCategory":"medium","hasChainKill":true}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Combat hull (warrior — armes lourdes anti-heavy)
INSERT INTO module_definitions (id, hull_id, rarity, kind, name, description, image, enabled, effect) VALUES
  ('combat-w-anti-fighter', 'combat', 'common', 'weapon',
   'Mitrailleuse anti-chasseur',
   '3 tirs anti-light avec chaîne de kill — nettoie les essaims légers.',
   '', true,
   '{"type":"weapon","profile":{"damage":10,"shots":3,"targetCategory":"light","hasChainKill":true}}'::jsonb),
  ('combat-w-ballistic',    'combat', 'rare',   'weapon',
   'Canon balistique',
   '1 tir anti-heavy puissant. Idéal contre les capitaux ennemis.',
   '', true,
   '{"type":"weapon","profile":{"damage":50,"shots":1,"targetCategory":"heavy"}}'::jsonb),
  ('combat-w-railgun',      'combat', 'epic',   'weapon',
   'Railgun lourd',
   '1 tir anti-heavy avec rafale ×2 vs heavy. Décape les BC enemy.',
   '', true,
   '{"type":"weapon","profile":{"damage":90,"shots":1,"targetCategory":"heavy","rafale":{"category":"heavy","count":2}}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Scientific hull (explorer — armes de précision avec multi-targeting)
INSERT INTO module_definitions (id, hull_id, rarity, kind, name, description, image, enabled, effect) VALUES
  ('sci-w-scout-drone',     'scientific', 'common', 'weapon',
   'Drone éclaireur',
   '2 tirs anti-light avec chaîne de kill — révèle puis détruit les cibles légères.',
   '', true,
   '{"type":"weapon","profile":{"damage":8,"shots":2,"targetCategory":"light","hasChainKill":true}}'::jsonb),
  ('sci-w-ion-jammer',      'scientific', 'rare',   'weapon',
   'Brouilleur ionique',
   '1 tir anti-medium avec rafale ×3 vs light. Désorganise les escortes.',
   '', true,
   '{"type":"weapon","profile":{"damage":24,"shots":1,"targetCategory":"medium","rafale":{"category":"light","count":3}}}'::jsonb),
  ('sci-w-harmonic-salvo',  'scientific', 'epic',   'weapon',
   'Salve harmonique',
   '3 tirs anti-medium synchronisés. Volume de feu massif.',
   '', true,
   '{"type":"weapon","profile":{"damage":40,"shots":3,"targetCategory":"medium"}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Marker idempotence
INSERT INTO _migrations_state (key, value)
VALUES ('weapon_modules_init', 'done')
ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now();
