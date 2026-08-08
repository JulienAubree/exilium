-- universe_config : retrait des 25 cles du systeme « Expeditions espace
-- profond » et des 4 cles d'XP de vaisseau amiral, tous deux retires du jeu.
--
-- Aucun lecteur (0 hit repo-wide, y compris par template string : les seules
-- cles construites dynamiquement sont `pirate_fp_${tier}_*` et
-- `exilium_drop_rate_${source}`, et 'expedition' a ete retiree de ExiliumSource
-- dans le lot 1 bis). Absentes de seed-game-config.ts ET de game-config-data.ts,
-- donc le DELETE est durable meme apres le `db:seed` de deploy.sh.
--
-- Le module moteur packages/game-engine/src/formulas/flagship-xp.ts a ete
-- supprime dans le meme chantier (lot 1 bis) : la table `flagships` n'a plus ni
-- colonne `level` ni colonne `xp` depuis le retrait du systeme de talents.
--
-- /!\ NE JAMAIS ecrire `DELETE ... WHERE key LIKE 'flagship%'`. Deux cles
-- voisines sont VIVANTES et la reparation du vaisseau amiral des 25 joueurs en
-- depend (19 lignes `flagship_repair` dans exilium_log) :
--     flagship_repair_duration_seconds      (lue par flagship.service.ts)
--     flagship_instant_repair_exilium_cost  (lue par flagship.service.ts)
-- On enumere, cle par cle.

DELETE FROM universe_config WHERE key IN (
  -- Expeditions espace profond (25)
  'expedition_awaiting_decision_timeout_hours',
  'expedition_hydrogen_base_cost_deep',
  'expedition_hydrogen_base_cost_early',
  'expedition_hydrogen_base_cost_mid',
  'expedition_hydrogen_mass_factor',
  'expedition_kill_switch',
  'expedition_max_active',
  'expedition_offer_expiration_hours',
  'expedition_refill_cooldown_seconds',
  'expedition_required_research_min_level',
  'expedition_return_seconds_deep',
  'expedition_return_seconds_early',
  'expedition_return_seconds_mid',
  'expedition_step_duration_deep_seconds',
  'expedition_step_duration_early_seconds',
  'expedition_step_duration_mid_seconds',
  'expedition_tier_pondering_deep',
  'expedition_tier_pondering_early',
  'expedition_tier_pondering_mid',
  'expedition_total_steps_deep_max',
  'expedition_total_steps_deep_min',
  'expedition_total_steps_early_max',
  'expedition_total_steps_early_min',
  'expedition_total_steps_mid_max',
  'expedition_total_steps_mid_min',
  -- XP de vaisseau amiral (4) — systeme retire, module moteur supprime
  'flagship_max_level',
  'flagship_xp_level_multiplier_pct',
  'flagship_xp_per_depth_bonus',
  'flagship_xp_per_kill_fp_factor'
);
