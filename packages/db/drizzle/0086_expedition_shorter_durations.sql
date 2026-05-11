-- Réduction des durées des Missions d'exploration en espace profond.
-- Avec 4-5 étapes + phase de retour, les durées initiales (10/20/30 min
-- par étape + 30/60/120 min de retour) faisaient des missions trop
-- longues (~4h pour une deep). On divise par ~5.

BEGIN;

-- Durée d'une étape
UPDATE universe_config SET value = '120'::jsonb  WHERE key = 'expedition_step_duration_early_seconds';  -- 2 min
UPDATE universe_config SET value = '240'::jsonb  WHERE key = 'expedition_step_duration_mid_seconds';    -- 4 min
UPDATE universe_config SET value = '360'::jsonb  WHERE key = 'expedition_step_duration_deep_seconds';   -- 6 min

-- Durée du retour de la flotte
UPDATE universe_config SET value = '300'::jsonb  WHERE key = 'expedition_return_seconds_early';         -- 5 min
UPDATE universe_config SET value = '600'::jsonb  WHERE key = 'expedition_return_seconds_mid';           -- 10 min
UPDATE universe_config SET value = '1200'::jsonb WHERE key = 'expedition_return_seconds_deep';          -- 20 min

COMMIT;
