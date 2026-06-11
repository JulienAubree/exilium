-- 0099 — Fusion des chantiers : le Centre de commandement (commandCenter)
-- est absorbé par le Chantier spatial (shipyard), qui construit désormais
-- tous les vaisseaux. Spec : docs/plans/2026-06-10-fusion-chantier.md
-- Compensation : niveau fusionné = max(SY, CC) ; les deux bâtiments ayant la
-- même courbe de coût (400/200/100 minerai/silicium/hydrogène, facteur 2),
-- l'investissement redondant — les niveaux 1..min(SY, CC) — est remboursé
-- intégralement sur la planète : base × (2^min − 1) par ressource.

-- 1. Re-router les prérequis des vaisseaux militaires AVANT le DELETE du
--    bâtiment (FK ON DELETE CASCADE les emporterait). Mêmes niveaux.
UPDATE ship_prerequisites
SET required_building_id = 'shipyard'
WHERE required_building_id = 'commandCenter';

-- 2. Rembourser l'investissement redondant (niveaux 1..min des deux bâtiments).
UPDATE planets p SET
  minerai   = p.minerai   + (400 * (power(2, LEAST(cc.level, COALESCE(sy.level, 0))) - 1))::numeric,
  silicium  = p.silicium  + (200 * (power(2, LEAST(cc.level, COALESCE(sy.level, 0))) - 1))::numeric,
  hydrogene = p.hydrogene + (100 * (power(2, LEAST(cc.level, COALESCE(sy.level, 0))) - 1))::numeric
FROM planet_buildings cc
LEFT JOIN planet_buildings sy
  ON sy.planet_id = cc.planet_id AND sy.building_id = 'shipyard'
WHERE cc.building_id = 'commandCenter'
  AND cc.planet_id = p.id
  AND LEAST(cc.level, COALESCE(sy.level, 0)) > 0;

-- 3. Niveau fusionné = max(SY, CC).
INSERT INTO planet_buildings (planet_id, building_id, level)
SELECT cc.planet_id, 'shipyard', GREATEST(cc.level, COALESCE(sy.level, 0))
FROM planet_buildings cc
LEFT JOIN planet_buildings sy
  ON sy.planet_id = cc.planet_id AND sy.building_id = 'shipyard'
WHERE cc.building_id = 'commandCenter'
ON CONFLICT (planet_id, building_id) DO UPDATE SET level = EXCLUDED.level;

DELETE FROM planet_buildings WHERE building_id = 'commandCenter';

-- 4. Upgrades du Centre en cours/en file : annulés + remboursés (le coût est
--    payé au démarrage ; coût du niveau visé L = base × 2^(L-1)).
--    (Aucune entrée active au moment de l'écriture — clause défensive.)
UPDATE planets p SET
  minerai   = p.minerai   + (400 * power(2, q.quantity - 1))::numeric,
  silicium  = p.silicium  + (200 * power(2, q.quantity - 1))::numeric,
  hydrogene = p.hydrogene + (100 * power(2, q.quantity - 1))::numeric
FROM build_queue q
WHERE q.planet_id = p.id
  AND q.type = 'building' AND q.item_id = 'commandCenter'
  AND q.status IN ('active', 'queued');

DELETE FROM build_queue
WHERE type = 'building' AND item_id = 'commandCenter'
  AND status IN ('active', 'queued');

-- 5. Les productions de vaisseaux migrent vers la facility unique (y compris
--    l'historique, pour la cohérence des affichages).
UPDATE build_queue SET facility_id = 'shipyard' WHERE facility_id = 'commandCenter';

-- 6. Config : l'ancien bonus de temps militaire (le seed insère la version
--    portée par le chantier), puis le bâtiment lui-même (CASCADE nettoie
--    building_prerequisites).
DELETE FROM bonus_definitions WHERE id = 'commandCenter__ship_build_time__build_military';
DELETE FROM building_definitions WHERE id = 'commandCenter';
