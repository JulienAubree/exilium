-- 0091 — Retrait des anomalies, des expéditions en espace profond, et des
-- modules / XP / paliers d'anomalie du vaisseau amiral.
--
-- ⚠️ DESTRUCTIF : supprime des tables et des colonnes (avec leurs données).
-- La coque (hull_id, hull_*, flagship_cooldowns) et les rapports de découverte
-- (exploration_reports) sont CONSERVÉS.

-- ── Vaisseau amiral : retour aux stats de base + coque ──────────────────────
ALTER TABLE flagships
  DROP COLUMN IF EXISTS module_loadout,
  DROP COLUMN IF EXISTS epic_charges_current,
  DROP COLUMN IF EXISTS epic_charges_max,
  DROP COLUMN IF EXISTS xp,
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS max_tier_unlocked,
  DROP COLUMN IF EXISTS max_tier_completed;

-- ── Expéditions en espace profond ───────────────────────────────────────────
DROP TABLE IF EXISTS expedition_anomaly_credits CASCADE;
DROP TABLE IF EXISTS exploration_missions CASCADE;
DROP TABLE IF EXISTS exploration_content CASCADE;

-- ── Anomalies ───────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS anomalies CASCADE;
DROP TABLE IF EXISTS anomaly_content CASCADE;

-- ── Modules / Arsenal du vaisseau amiral ────────────────────────────────────
DROP TABLE IF EXISTS flagship_module_inventory CASCADE;
DROP TABLE IF EXISTS module_definitions CASCADE;

-- ── Talents du vaisseau amiral (table déjà archivée depuis 0069) ────────────
DROP TABLE IF EXISTS flagship_talents CASCADE;

-- ── Nettoyage de la config (clés désormais inutilisées) ─────────────────────
DELETE FROM universe_config WHERE key LIKE 'anomaly\_%';
DELETE FROM universe_config WHERE key = 'exilium_drop_rate_expedition';
