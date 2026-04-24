-- Indexes pensés pour le scaling (~10k users).
--
-- Sélection via un audit :
--   1. Colonnes FK sans index qui sont filtrées par des requêtes du hot path
--   2. Colonnes qui déclenchent des Seq Scan sur toute la table (EXPLAIN
--      ANALYZE confirmait un seq_scan même sur petite table, signalant que
--      Postgres n'a pas d'alternative — à 10k users ce seq_scan devient une
--      lecture full-table de centaines de MB)
--
-- Les indexes sont créés non-CONCURRENTLY parce qu'ils sont petits
-- aujourd'hui (tables < 25k lignes). Pour un rollout à l'échelle, passer
-- en CREATE INDEX CONCURRENTLY hors transaction.

-- Cleanup game_events > 30 days tombait en full seq_scan (mesuré 26ms/22k
-- rows). À 240M rows (10k users × 30j × 800 events/j), sans index le DELETE
-- dépasse la fenêtre de maintenance.
CREATE INDEX IF NOT EXISTS "game_events_created_at_idx"
  ON "game_events" ("created_at");

-- listInboundFleets et les queries "fleets qui arrivent chez moi" filtrent
-- par target_planet_id. Aucune index existant pour cette direction (seul
-- origin_planet_id était indexé).
CREATE INDEX IF NOT EXISTS "fleet_events_target_planet_idx"
  ON "fleet_events" ("target_planet_id")
  WHERE "target_planet_id" IS NOT NULL;

-- PvE handlers (pirate, mine, scan…) lookup le fleet par pve_mission_id
-- pour valider ownership. Pas d'index → seq_scan.
CREATE INDEX IF NOT EXISTS "fleet_events_pve_mission_idx"
  ON "fleet_events" ("pve_mission_id")
  WHERE "pve_mission_id" IS NOT NULL;

-- Market listing par planet + filtrage statut.
CREATE INDEX IF NOT EXISTS "market_offers_planet_idx"
  ON "market_offers" ("planet_id");

-- Flagship service.get() lookup par userId utilise déjà l'index UNIQUE,
-- mais fleet handlers lookup parfois le flagship par planet_id (pour les
-- station missions → inject flagship home).
CREATE INDEX IF NOT EXISTS "flagships_planet_idx"
  ON "flagships" ("planet_id");

-- Mission reports liés à une fleet : quand on load un rapport de combat
-- on part du fleet event. Sans index : seq_scan sur mission_reports.
CREATE INDEX IF NOT EXISTS "mission_reports_fleet_event_idx"
  ON "mission_reports" ("fleet_event_id")
  WHERE "fleet_event_id" IS NOT NULL;

-- Colonization processes listing par user (overview shows "Colonies en
-- cours"). planet_id aussi filtré quand on charge une planète.
CREATE INDEX IF NOT EXISTS "colonization_processes_user_idx"
  ON "colonization_processes" ("user_id");
CREATE INDEX IF NOT EXISTS "colonization_processes_planet_idx"
  ON "colonization_processes" ("planet_id");

-- build_queue user filter (cascade delete + user-level queries comme
-- "voir toutes mes queues").
CREATE INDEX IF NOT EXISTS "build_queue_user_idx"
  ON "build_queue" ("user_id");

-- Planets filtrées par planet_class_id pour la validation deletePlanetType
-- (cherche s'il y a encore des planètes de ce type avant de le supprimer).
CREATE INDEX IF NOT EXISTS "planets_planet_class_idx"
  ON "planets" ("planet_class_id")
  WHERE "planet_class_id" IS NOT NULL;
