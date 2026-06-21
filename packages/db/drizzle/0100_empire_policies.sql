-- 0100 — Édits & Politiques d'Empire v1, chantier Empire §5.2.
-- Additif : aucune politique par défaut (comportement actuel inchangé).
CREATE TABLE IF NOT EXISTS empire_policies (
  user_id     uuid PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active      jsonb NOT NULL DEFAULT '{}'::jsonb,
  switched_at jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO universe_config (key, value) VALUES
  ('empire_policy_levels_per_slot', '10'::jsonb),
  ('policy_switch_cooldown_hours', '12'::jsonb)
ON CONFLICT (key) DO NOTHING;
