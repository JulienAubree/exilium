-- Archive les 3 tables talents (rename, données préservées pour audit)
-- IMPORTANT : flagship_cooldowns N'EST PAS archivée — elle stocke aussi le
-- cooldown du scan_mission (hull ability) via talent_id='scan_mission'.
-- La colonne talent_id devient un identifiant générique d'ability cooldown.
ALTER TABLE flagship_talents              RENAME TO flagship_talents_archive;
ALTER TABLE talent_definitions            RENAME TO talent_definitions_archive;
ALTER TABLE talent_branch_definitions     RENAME TO talent_branch_definitions_archive;
-- flagship_cooldowns conservée telle quelle (utilisée par scan_mission)

-- Stats baseline relevées sur tous les flagships existants
-- GREATEST/LEAST protège ceux qui auraient déjà des valeurs supérieures
UPDATE flagships SET
  cargo_capacity   = GREATEST(cargo_capacity, 8000),
  base_speed       = GREATEST(base_speed, 13000),
  fuel_consumption = LEAST(fuel_consumption, 72),
  shot_count       = GREATEST(shot_count, 5);

-- Cleanup universe_config (clés liées aux talents)
DELETE FROM universe_config
WHERE key IN (
  'talent_cost_tier_1', 'talent_cost_tier_2', 'talent_cost_tier_3',
  'talent_cost_tier_4', 'talent_cost_tier_5',
  'talent_tier_2_threshold', 'talent_tier_3_threshold',
  'talent_tier_4_threshold', 'talent_tier_5_threshold',
  'talent_respec_ratio', 'talent_full_reset_cost'
);

-- Marker idempotence
INSERT INTO _migrations_state (key, value)
VALUES ('flagship_talents_archived', 'done')
ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now();
