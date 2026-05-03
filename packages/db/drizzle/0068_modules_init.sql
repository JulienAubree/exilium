-- Catalog of available modules (admin-edited)
CREATE TABLE IF NOT EXISTS module_definitions (
  id           VARCHAR(64) PRIMARY KEY,
  hull_id      VARCHAR(32) NOT NULL,
  rarity       VARCHAR(16) NOT NULL,
  name         VARCHAR(80) NOT NULL,
  description  TEXT NOT NULL,
  image        VARCHAR(500) NOT NULL DEFAULT '',
  enabled      BOOLEAN NOT NULL DEFAULT true,
  effect       JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_module_rarity CHECK (rarity IN ('common', 'rare', 'epic')),
  CONSTRAINT chk_module_hull CHECK (hull_id IN ('combat', 'scientific', 'industrial'))
);
CREATE INDEX IF NOT EXISTS idx_modules_hull_rarity ON module_definitions(hull_id, rarity) WHERE enabled = true;

-- Player inventory of collected modules (with duplicates)
CREATE TABLE IF NOT EXISTS flagship_module_inventory (
  flagship_id  UUID NOT NULL REFERENCES flagships(id) ON DELETE CASCADE,
  module_id    VARCHAR(64) NOT NULL REFERENCES module_definitions(id) ON DELETE CASCADE,
  count        SMALLINT NOT NULL DEFAULT 1 CHECK (count > 0),
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (flagship_id, module_id)
);

-- New columns on flagships for loadout + epic charges
ALTER TABLE flagships
  ADD COLUMN IF NOT EXISTS module_loadout JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS epic_charges_current SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS epic_charges_max SMALLINT NOT NULL DEFAULT 1;

-- New columns on anomalies for in-run snapshot + pending epic effect
ALTER TABLE anomalies
  ADD COLUMN IF NOT EXISTS equipped_modules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_epic_effect JSONB;

-- Tracking table for one-off scripts (refund idempotence marker)
CREATE TABLE IF NOT EXISTS _migrations_state (
  key   VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
