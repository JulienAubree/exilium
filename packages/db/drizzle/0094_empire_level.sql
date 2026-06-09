-- 0094 — Le niveau d'empire remplace le « Centre de Pouvoir Impérial ».
-- La capacité de gouvernance et le niveau de missions sont désormais portés
-- par un niveau d'empire alimenté par de l'XP (constructions, recherches,
-- missions, combats, colonisations). Spec : docs/plans/2026-06-09-empire-level.md
--
-- ⚠️ Les joueurs ayant construit l'IPC le perdent SANS remboursement (décision
--    user 2026-06-09) mais conservent leur capacité via governance_floor
--    (plancher grandfathered = 1 + niveau IPC archivé).

CREATE TABLE IF NOT EXISTS empire_progression (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp bigint NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  governance_floor integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_empire_xp_positive CHECK (xp >= 0)
);

CREATE TABLE IF NOT EXISTS empire_xp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  source varchar(32) NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS empire_xp_log_user_created_idx ON empire_xp_log (user_id, created_at);

-- Grandfathering : archiver la capacité des joueurs ayant un IPC sur leur
-- planète-mère (capacité = 1 + niveau IPC). Tout le monde démarre niveau 1.
INSERT INTO empire_progression (user_id, governance_floor)
SELECT p.user_id, 1 + pb.level
FROM planet_buildings pb
JOIN planets p ON p.id = pb.planet_id
WHERE pb.building_id = 'imperialPowerCenter'
  AND p.planet_class_id = 'homeworld'
  AND pb.level > 0
ON CONFLICT (user_id) DO NOTHING;

-- File d'attente : annuler tout upgrade IPC en cours.
DELETE FROM build_queue WHERE item_id = 'imperialPowerCenter';

-- Données joueurs : retirer le bâtiment construit (homeworld + éventuelles
-- lignes legacy sur d'autres planètes).
DELETE FROM planet_buildings WHERE building_id = 'imperialPowerCenter';

-- Config : retirer la définition (aucun prérequis ne pointe vers l'IPC),
-- puis la catégorie « Gouvernance » (l'IPC en était le seul membre).
DELETE FROM building_definitions WHERE id = 'imperialPowerCenter';
DELETE FROM entity_categories WHERE id = 'building_gouvernance';

-- Paramètres du niveau d'empire (le seed les réinsère aussi via upsert).
INSERT INTO universe_config (key, value) VALUES
  ('empire_xp_curve_base', '100'::jsonb),
  ('empire_level_max', '100'::jsonb),
  ('empire_capacity_levels_per_colony', '2'::jsonb),
  ('empire_mission_levels_per_bonus', '5'::jsonb),
  ('empire_xp_per_building_level', '2'::jsonb),
  ('empire_xp_per_research_level', '5'::jsonb),
  ('empire_xp_pve_victory', '15'::jsonb),
  ('empire_xp_pvp_victory', '40'::jsonb),
  ('empire_xp_colonization', '150'::jsonb)
ON CONFLICT (key) DO NOTHING;
