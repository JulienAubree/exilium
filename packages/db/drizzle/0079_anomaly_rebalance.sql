-- V8.9 Anomaly rebalance (2026-05-04)
-- Le palier 1 était trop dur pour un débutant : 80 FP enemy au depth 1 alors
-- qu'un flagship industrial level 9 avec recherches niv 3/4 plafonne à ~50 FP.
-- Le loot était aussi délirant : run depth 20 palier 1 = ~6.9M ressources
-- (vs ~100k cost d'un bâtiment mid-game).
--
-- Nouvelle calibration :
--   anomaly_tier_base_fp     80   → 40    (palier 1 depth 1 = tuto réel)
--   anomaly_tier_fp_growth   1.7  → 1.6   (paliers moins steep)
--   anomaly_enemy_max_ratio  3.0  → 2.0   (depth 20 = ×2 au lieu de ×3)
--   anomaly_loot_base        5000 → 1500  (base ~3× plus basse)
--   anomaly_loot_growth      1.4  → 1.20  (depth 20 = ×32 au lieu de ×275)
--
-- Effets nets :
--   - palier 1 depth 1 : 40 FP   (débutant gère)
--   - palier 1 depth 20 : 80 FP  (joueur a level up)
--   - palier 5 depth 20 : ~520 FP
--   - palier 10 depth 20 : ~5.5k FP
--   - palier 20 depth 20 : ~590k FP (vs 1.6M avant)
--   - run depth 20 palier 1 : ~48k ressources (vs 6.9M)
--   - run depth 20 palier 10 : ~480k ressources

UPDATE universe_config SET value = '40'::jsonb   WHERE key = 'anomaly_tier_base_fp';
UPDATE universe_config SET value = '1.6'::jsonb  WHERE key = 'anomaly_tier_fp_growth';
UPDATE universe_config SET value = '2.0'::jsonb  WHERE key = 'anomaly_enemy_max_ratio';
UPDATE universe_config SET value = '1500'::jsonb WHERE key = 'anomaly_loot_base';
UPDATE universe_config SET value = '1.20'::jsonb WHERE key = 'anomaly_loot_growth';

-- Marker idempotence
INSERT INTO _migrations_state (key, value)
VALUES ('anomaly_rebalance_v89', 'done')
ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now();
