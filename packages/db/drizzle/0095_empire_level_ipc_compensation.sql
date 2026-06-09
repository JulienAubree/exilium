-- 0095 — Compensation IPC par niveau d'empire (remplace le plancher).
-- Décision user 2026-06-09 : plutôt qu'un plancher de capacité grandfathered,
-- les ex-détenteurs d'IPC reçoivent directement le niveau d'empire dont la
-- formule donne leur ancienne capacité. Le système devient pur :
-- capacité = f(niveau), sans cas particulier.
--
-- Inversion de la formule (capacité = 1 + (L-1)/2, avec
-- empire_capacity_levels_per_colony = 2) : capacité visée = floor
-- (= 1 + ex-IPC) → L = 2×floor − 1 ; XP = empire_xp_curve_base(100) × (L-1)×L/2.
-- ⚠️ constantes 2 et 100 figées ici, cohérentes avec universe_config au moment
-- de la migration.

-- Tracer la compensation dans le log d'XP (audit).
INSERT INTO empire_xp_log (user_id, amount, source, details)
SELECT user_id,
       100 * (2 * governance_floor - 2) * (2 * governance_floor - 1) / 2,
       'admin',
       jsonb_build_object('reason', 'ipc_compensation',
                          'governanceFloor', governance_floor,
                          'targetLevel', 2 * governance_floor - 1)
FROM empire_progression
WHERE governance_floor > 1;

-- Créditer l'XP (en sus de l'XP déjà gagnée depuis le déploiement) et poser
-- le niveau correspondant.
UPDATE empire_progression ep
SET xp = ep.xp + 100 * (2 * ep.governance_floor - 2) * (2 * ep.governance_floor - 1) / 2,
    level = GREATEST(ep.level, 2 * ep.governance_floor - 1),
    updated_at = now()
WHERE ep.governance_floor > 1;

-- Le plancher n'a plus de raison d'être.
ALTER TABLE empire_progression DROP COLUMN IF EXISTS governance_floor;
