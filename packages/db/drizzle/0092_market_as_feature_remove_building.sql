-- 0092 — Le marché devient une fonctionnalité, plus un bâtiment.
-- Le commerce P2P est désormais toujours disponible ; le plafond d'offres
-- simultanées est piloté par universe_config.market_max_offers (défaut 10).
--
-- ⚠️ Les joueurs ayant construit le « Marché Galactique » perdent ce bâtiment.
--    La compensation (annonce + don d'Exilium/ressources) se gère HORS migration.

-- File d'attente : annuler tout upgrade de galacticMarket en cours.
DELETE FROM build_queue WHERE item_id = 'galacticMarket';

-- Données joueurs : retirer le bâtiment construit.
DELETE FROM planet_buildings WHERE building_id = 'galacticMarket';

-- Config : retirer la définition du bâtiment (cascade sur building_prerequisites)
-- puis sa catégorie. Le seed fait des upserts → il ne supprime pas les entrées
-- retirées, on le fait donc ici.
DELETE FROM building_definitions WHERE id = 'galacticMarket';
DELETE FROM entity_categories WHERE id = 'building_commerce';

-- Plafond d'offres global (le seed le réinsère aussi via upsert).
INSERT INTO universe_config (key, value)
  VALUES ('market_max_offers', '10'::jsonb)
  ON CONFLICT (key) DO NOTHING;
