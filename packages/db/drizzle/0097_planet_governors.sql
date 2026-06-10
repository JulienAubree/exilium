-- 0097 — Gouverneurs v1 (délégation par directive), chantier Empire §5.3.
-- Additif : null = gestion manuelle (comportement actuel).
ALTER TABLE planets ADD COLUMN IF NOT EXISTS governor varchar(32);

INSERT INTO universe_config (key, value) VALUES
  ('governor_unlock_level', '8'::jsonb),
  ('governor_tick_minutes', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;
