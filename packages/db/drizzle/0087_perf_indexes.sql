-- Indexes de performance identifiés par l'audit perf API.
--
-- 1. `fleet_events.target_planet_id` : utilisé par `getEmpireOverview`
--    pour lister les flottes entrantes (`WHERE target_planet_id IN (...)`).
--    Sans index, scan séquentiel sur fleet_events à chaque ouverture
--    de l'empire.
--
-- 2. `fleet_events(user_id, status)` : filtre courant dans `planet.service`
--    et `event-catchup.ts` (`WHERE user_id = ? AND status = 'active'`).
--    L'index sur `user_id` seul existe déjà, mais Postgres doit ensuite
--    filtrer par status. Index composé = plan d'exécution direct.
--
-- 3. `planets(user_id, status)` : lectures fréquentes de l'empire d'un
--    joueur excluant les colonies en cours d'abandon / colonisation.
--
-- Toutes les créations utilisent `CREATE INDEX IF NOT EXISTS` pour être
-- idempotentes. `CONCURRENTLY` est omis car la table est verrouillée le
-- temps de la migration (acceptable hors heures de pointe).

BEGIN;

CREATE INDEX IF NOT EXISTS fleet_events_target_planet_idx
  ON fleet_events (target_planet_id);

CREATE INDEX IF NOT EXISTS fleet_events_user_status_idx
  ON fleet_events (user_id, status);

CREATE INDEX IF NOT EXISTS planets_user_status_idx
  ON planets (user_id, status);

COMMIT;
