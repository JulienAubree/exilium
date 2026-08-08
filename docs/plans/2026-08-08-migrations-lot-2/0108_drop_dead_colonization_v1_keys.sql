-- universe_config : retrait des 17 cles de la colonisation v1, remplacee par la
-- refonte « colonie vivante » (670c4079, 2026-04-16) qui a supprime le
-- ravitaillement dedie, l'action de consolidation et les evenements aleatoires
-- au profit d'une consommation continue, de raids reels et d'une garnison.
--
-- Aucun lecteur :
--   grep -rnE "colonization_(supply_|reinforce_boost|reinforce_max|consolidate|event_)" -> 0
-- Retirees du seed par ce meme commit -> orphelines pures d'upsert, le DELETE
-- est durable apres le `db:seed` que deploy.sh rejoue.
--
-- /!\ NE JAMAIS ecrire `DELETE ... WHERE key LIKE 'colonization_%'` : il y a 50
-- cles `colonization_*` en base et 33 sont VIVANTES (consommation, seuils
-- d'avant-poste, difficulte par type de planete, raids, bonus de convoi et de
-- garnison...). On enumere les 17 mortes, une par une.
--
-- A noter pour l'auditeur suivant : `colonization_cost_scaling_factor` est LUE
-- (colonization.service.ts) mais n'existe pas en base — elle tombe sur son
-- defaut `|| 0.5`. Ce motif `Number(config.universe.X) || defaut` masque toute
-- cle manquante : c'est pourquoi supprimer une cle ne provoque jamais d'erreur
-- visible, et pourquoi chaque suppression merite une double verification.

DELETE FROM universe_config WHERE key IN (
  -- Ravitaillement de colonie dedie (4)
  'colonization_supply_boost',
  'colonization_supply_boost_per_tranche',
  'colonization_supply_max_boost',
  'colonization_supply_tranche_size',
  -- Bonus de renfort de l'ancien modele (3) — le renfort actuel pose une
  -- garnison, il n'applique plus de boost de progression
  'colonization_reinforce_boost',
  'colonization_reinforce_boost_per_ship',
  'colonization_reinforce_max_boost',
  -- Action « consolider » (4) — retiree
  'colonization_consolidate_boost',
  'colonization_consolidate_cooldown',
  'colonization_consolidate_cost_minerai',
  'colonization_consolidate_cost_silicium',
  -- Evenements aleatoires binaires (6) — remplaces par les raids reels
  'colonization_event_interval',
  'colonization_event_deadline_min',
  'colonization_event_deadline_max',
  'colonization_event_raid_penalty',
  'colonization_event_resolve_bonus',
  'colonization_event_shortage_penalty'
);
