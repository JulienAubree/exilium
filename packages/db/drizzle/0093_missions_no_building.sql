-- 0093 — Les missions ne sont plus gatées par un bâtiment.
-- Suppression du « Centre de missions » (accès + cadence) et du « Relais de
-- missions » (bonus de récompenses). L'onglet Missions reste accessible ;
-- cadence + scaling utilisent un niveau par défaut (universe_config.mission_default_level),
-- à brancher plus tard sur le niveau d'empire.
--
-- ⚠️ Les joueurs ayant construit ces bâtiments les perdent. Compensation
--    éventuelle à gérer hors migration (annonce + don).
-- NB: la table mission_center_state (timers de découverte par joueur) est CONSERVÉE.

-- File d'attente : annuler tout upgrade de ces bâtiments en cours.
DELETE FROM build_queue WHERE item_id IN ('missionCenter', 'missionRelay');

-- Données joueurs : retirer les bâtiments construits.
DELETE FROM planet_buildings WHERE building_id IN ('missionCenter', 'missionRelay');

-- Config : retirer les définitions (cascade sur building_prerequisites ET
-- research_prerequisites — required_building_id est en ON DELETE CASCADE),
-- puis la catégorie « Exploration » (désormais vide).
DELETE FROM building_definitions WHERE id IN ('missionCenter', 'missionRelay');
DELETE FROM entity_categories WHERE id = 'building_exploration';

-- Niveau de missions par défaut (le seed le réinsère aussi via upsert).
INSERT INTO universe_config (key, value)
  VALUES ('mission_default_level', '3'::jsonb)
  ON CONFLICT (key) DO NOTHING;
