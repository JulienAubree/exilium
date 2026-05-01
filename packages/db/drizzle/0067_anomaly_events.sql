-- Anomalie V3 — événements narratifs entre combats.
-- Cinq nouvelles colonnes sur `anomalies` pour piloter l'alternance combat/event.
ALTER TABLE anomalies
  ADD COLUMN next_node_type VARCHAR(8) NOT NULL DEFAULT 'combat',
  ADD COLUMN next_event_id VARCHAR(40),
  ADD COLUMN seen_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN combats_until_next_event SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN event_log JSONB NOT NULL DEFAULT '[]'::jsonb;
