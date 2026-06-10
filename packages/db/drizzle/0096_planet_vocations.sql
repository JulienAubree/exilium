-- 0096 — Spécialisation des mondes (vocations), chantier Empire v1.
-- Spec : docs/plans/2026-06-10-specialisation-mondes-v1.md
-- Additif et sans danger : null = équilibrée (comportement actuel).

ALTER TABLE planets ADD COLUMN IF NOT EXISTS vocation varchar(32);
ALTER TABLE planets ADD COLUMN IF NOT EXISTS vocation_changed_at timestamptz;

INSERT INTO universe_config (key, value) VALUES
  ('vocation_unlock_level', '5'::jsonb),
  ('vocation_cooldown_hours', '168'::jsonb),
  ('vocation_reconversion_minerai', '50000'::jsonb),
  ('vocation_reconversion_silicium', '25000'::jsonb),
  ('vocation_miniere_production_bonus', '0.20'::jsonb),
  ('vocation_miniere_construction_malus', '0.15'::jsonb),
  ('vocation_industrielle_production_malus', '0.10'::jsonb),
  ('vocation_industrielle_construction_bonus', '0.20'::jsonb)
ON CONFLICT (key) DO NOTHING;
