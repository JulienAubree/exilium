-- Anomaly V4 — flagship-only schema additions

-- Nouvelles colonnes pour les charges réparation
ALTER TABLE anomalies
  ADD COLUMN repair_charges_current SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN repair_charges_max     SMALLINT NOT NULL DEFAULT 3;

-- Universe config tunables
INSERT INTO universe_config (key, value) VALUES
  ('anomaly_repair_charges_per_run', 3),
  ('anomaly_repair_charge_hull_pct', 0.30)
ON CONFLICT (key) DO NOTHING;

-- Marker idempotence
INSERT INTO _migrations_state (key, value)
VALUES ('anomaly_v4_schema', 'done')
ON CONFLICT (key) DO UPDATE SET value = 'done', set_at = now();
