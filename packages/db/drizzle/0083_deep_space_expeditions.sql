-- Missions d'exploration en espace profond — Phase 1 (backend).
-- Trois tables :
--   1. exploration_missions : instances de missions par joueur
--   2. exploration_content   : singleton JSONB admin (secteurs + événements)
--   3. expedition_anomaly_credits : crédits d'engagement anomalie gratuits
--      issus de l'événement passerelle.
-- Plus les universe_config keys de paramétrage.
--
-- Cf. spec docs/superpowers/specs/2026-05-11-deep-space-exploration-missions-design.md

BEGIN;

-- ─── 1. Missions (instances) ──────────────────────────────────────────────

CREATE TABLE exploration_missions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Secteur narratif (référence le contenu admin, snapshot pour l'affichage)
  sector_id       varchar(64) NOT NULL,
  sector_name     varchar(120) NOT NULL,
  tier            varchar(16) NOT NULL,                -- 'early' | 'mid' | 'deep'

  -- Progression
  total_steps     integer NOT NULL,                    -- 1..5
  current_step    integer NOT NULL DEFAULT 0,
  status          varchar(24) NOT NULL DEFAULT 'available',
                  -- 'available' | 'engaged' | 'awaiting_decision'
                  -- | 'completed' | 'failed' | 'expired'

  -- Flotte engagée (FIGÉ à l'engagement, jamais modifié après)
  fleet_snapshot  jsonb,
  fleet_origin_planet_id uuid REFERENCES planets(id) ON DELETE SET NULL,

  -- État courant de la flotte (LIVE — modifié par les combats)
  fleet_status    jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Événement en attente de décision
  pending_event_id varchar(64),

  -- Cumul des effets appliqués (crédité seulement à completeMission)
  outcomes_accumulated jsonb NOT NULL DEFAULT
    '{"minerai":0,"silicium":0,"hydrogene":0,"exilium":0,"modules":[],"biomeRevealsRequested":0,"hullDeltaTotal":0,"anomalyEngagementUnlocked":null}'::jsonb,

  step_log        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Briefing snapshot + paramètres calculés à la génération
  briefing        text NOT NULL,
  hydrogen_cost   integer NOT NULL DEFAULT 0,
  estimated_duration_seconds integer NOT NULL,
  next_step_at    timestamptz,

  -- Idempotence resolveStep (évite double-clic / replay)
  last_resolution_token uuid,

  created_at      timestamptz NOT NULL DEFAULT now(),
  engaged_at      timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz NOT NULL
);

CREATE INDEX exp_missions_user_status_idx
  ON exploration_missions(user_id, status);

CREATE INDEX exp_missions_tick_idx
  ON exploration_missions(next_step_at)
  WHERE status = 'engaged';

CREATE INDEX exp_missions_expire_idx
  ON exploration_missions(expires_at)
  WHERE status = 'available';

CREATE INDEX exp_missions_timeout_idx
  ON exploration_missions(user_id)
  WHERE status = 'awaiting_decision';


-- ─── 2. Contenu admin (singleton) ─────────────────────────────────────────

CREATE TABLE exploration_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Une seule ligne logique. Le service la crée si absente.


-- ─── 3. Crédits d'engagement anomalie (événement passerelle) ──────────────

CREATE TABLE expedition_anomaly_credits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier              smallint NOT NULL,                 -- 1, 2 ou 3
  source_mission_id uuid REFERENCES exploration_missions(id) ON DELETE SET NULL,
  consumed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expedition_anomaly_credits_user_idx
  ON expedition_anomaly_credits(user_id)
  WHERE consumed_at IS NULL;


-- ─── 4. Universe config (paramètres) ──────────────────────────────────────

INSERT INTO universe_config (key, value) VALUES
  ('expedition_max_active',                          '3'),
  ('expedition_offer_expiration_hours',              '72'),
  ('expedition_awaiting_decision_timeout_hours',     '168'),
  ('expedition_step_duration_early_seconds',         '600'),
  ('expedition_step_duration_mid_seconds',           '1200'),
  ('expedition_step_duration_deep_seconds',          '1800'),
  ('expedition_hydrogen_base_cost_early',            '200'),
  ('expedition_hydrogen_base_cost_mid',              '800'),
  ('expedition_hydrogen_base_cost_deep',             '2400'),
  ('expedition_hydrogen_mass_factor',                '0.4'),
  ('expedition_total_steps_early_min',               '1'),
  ('expedition_total_steps_early_max',               '2'),
  ('expedition_total_steps_mid_min',                 '2'),
  ('expedition_total_steps_mid_max',                 '3'),
  ('expedition_total_steps_deep_min',                '3'),
  ('expedition_total_steps_deep_max',                '5'),
  ('expedition_required_research_min_level',         '1'),
  ('expedition_kill_switch',                         '0'),
  ('expedition_refill_cooldown_seconds',             '3600'),
  ('expedition_tier_pondering_early',                '0.8'),
  ('expedition_tier_pondering_mid',                  '0.5'),
  ('expedition_tier_pondering_deep',                 '0.4')
ON CONFLICT (key) DO NOTHING;


COMMIT;
