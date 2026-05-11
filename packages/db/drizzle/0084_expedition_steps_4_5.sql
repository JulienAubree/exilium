-- Uniformise le nombre d'étapes des Missions d'exploration en espace
-- profond : 4 à 5 étapes pour tous les paliers (au lieu de 1-2 / 2-3 / 3-5).
-- Plus de gameplay narratif quel que soit le palier.

BEGIN;

UPDATE universe_config SET value = '4'::jsonb WHERE key = 'expedition_total_steps_early_min';
UPDATE universe_config SET value = '5'::jsonb WHERE key = 'expedition_total_steps_early_max';
UPDATE universe_config SET value = '4'::jsonb WHERE key = 'expedition_total_steps_mid_min';
UPDATE universe_config SET value = '5'::jsonb WHERE key = 'expedition_total_steps_mid_max';
UPDATE universe_config SET value = '4'::jsonb WHERE key = 'expedition_total_steps_deep_min';
UPDATE universe_config SET value = '5'::jsonb WHERE key = 'expedition_total_steps_deep_max';

COMMIT;
