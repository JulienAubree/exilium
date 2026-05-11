-- Retrait du sous-système PvE "exploration recon" introduit en 0062.
-- Remplacé par les Missions d'exploration en espace profond (cf. spec
-- 2026-05-11-deep-space-exploration-missions-design.md). Phase 0 du
-- chantier : nettoyage de l'ancien système avant la construction du nouveau.
--
-- Effets :
--   1. Marque les contrats reconnaissance en cours comme expirés (audit conservé).
--   2. Supprime la colonne de cron du mission_center_state.
--   3. Purge les clés universe_config orphelines.
--
-- Sécurité : pas de DROP de table. Les lignes pve_missions de type 'exploration'
-- sont conservées (statut 'expired') pour traçabilité historique.

BEGIN;

-- 1. Expirer les contrats reconnaissance encore actifs
UPDATE pve_missions
   SET status = 'expired'
 WHERE mission_type = 'exploration'
   AND status IN ('available', 'in_progress');

-- 2. Retirer la colonne du cron exploration
ALTER TABLE mission_center_state
  DROP COLUMN IF EXISTS next_exploration_discovery_at;

-- 3. Cleanup universe_config
DELETE FROM universe_config
 WHERE key IN (
   'pve_max_exploration_missions',
   'pve_exploration_min_distance',
   'pve_exploration_expiration_hours'
 );

COMMIT;
