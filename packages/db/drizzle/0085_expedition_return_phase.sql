-- Ajoute une phase de retour aux Missions d'exploration en espace profond.
-- À la fin d'une mission (succès, échec ou rappel anticipé), la flotte
-- n'est plus immédiatement rendue à la planète : elle entre en status
-- 'returning' jusqu'à `return_at`. Le cron finalise alors le crédit des
-- ressources, modules, exilium et le retour des vaisseaux.

BEGIN;

ALTER TABLE exploration_missions
  ADD COLUMN IF NOT EXISTS return_at timestamptz;

CREATE INDEX IF NOT EXISTS exp_missions_return_idx
  ON exploration_missions(return_at)
  WHERE status = 'returning';

-- Durées de retour par palier (paramétrables admin)
INSERT INTO universe_config (key, value) VALUES
  ('expedition_return_seconds_early', '1800'),
  ('expedition_return_seconds_mid',   '3600'),
  ('expedition_return_seconds_deep',  '7200')
ON CONFLICT (key) DO NOTHING;

COMMIT;
