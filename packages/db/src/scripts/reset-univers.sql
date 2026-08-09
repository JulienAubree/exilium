-- ============================================================================
-- RESET D'UNIVERS — la carte neuve
-- ============================================================================
--
-- ⚠️ CE SCRIPT DÉTRUIT LA PARTIE EN COURS. Il n'est PAS une migration, il n'est
-- PAS réentrant, et il ne doit JAMAIS être placé dans packages/db/drizzle/ :
-- `apply-migrations.sh` le jouerait tout seul au prochain déploiement.
--
-- Il se joue À LA MAIN, par Julien, une seule fois, le jour du lancement.
--
-- ── Avant de lancer ────────────────────────────────────────────────────────
--
--   1. BACKUP. Non négociable, et vérifié :
--        bash scripts/backup-postgres.sh
--        ls -la /opt/backups/   # le fichier doit exister et peser
--
--   2. Arrêter le jeu, sinon un joueur écrit pendant qu'on efface :
--        pm2 stop exilium-api exilium-worker
--
--   3. Relire la section « CE QUI EST GARDÉ » plus bas et confirmer que la
--      liste correspond à ce qu'on veut conserver.
--
--   4. Régler la section CONFIG en fin de fichier (graine, dimensions, rythme)
--      AVANT de lancer — c'est le moment où l'on choisit le monde.
--
-- ── Lancer ─────────────────────────────────────────────────────────────────
--
--        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/src/scripts/reset-univers.sql
--
--   Ne PAS passer par `sudo -u postgres psql` : les objets créés
--   appartiendraient à `postgres` et l'application perdrait ses droits
--   (cf. CLAUDE.md, section Migrations & DB).
--
-- ── Après ──────────────────────────────────────────────────────────────────
--
--        pm2 start exilium-api exilium-worker && pm2 save
--        curl -s -o /dev/null -w '%{http_code}\n' https://exilium-game.com/health
--
--   Chaque joueur retrouve son compte et son mot de passe, mais AUCUNE planète.
--   La planète-mère est recréée à la première connexion, par le chemin normal
--   d'inscription (`createHomePlanet`). Vérifier ce point sur staging d'abord.
--
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── Garde-fou ───────────────────────────────────────────────────────────────
-- Refuse de tourner sur une base qui n'a pas l'air d'être une base Exilium,
-- et affiche ce qui va disparaître. Un reset lancé sur la mauvaise base est
-- l'erreur qu'on ne peut pas rattraper.
DO $$
DECLARE
  nb_users int;
  nb_planets int;
BEGIN
  IF to_regclass('public.planets') IS NULL OR to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Ce ne semble pas etre une base Exilium (tables planets/users absentes).';
  END IF;
  SELECT count(*) INTO nb_users FROM users;
  SELECT count(*) INTO nb_planets FROM planets;
  RAISE NOTICE '--------------------------------------------------------------';
  RAISE NOTICE 'RESET D UNIVERS';
  RAISE NOTICE '  base     : %', current_database();
  RAISE NOTICE '  comptes  : % (CONSERVES)', nb_users;
  RAISE NOTICE '  planetes : % (DETRUITES)', nb_planets;
  RAISE NOTICE '--------------------------------------------------------------';
END $$;

-- ============================================================================
-- CE QUI EST DÉTRUIT — l'état de la partie
-- ============================================================================
--
-- Un seul TRUNCATE : Postgres résout l'ordre des dépendances lui-même, ce
-- qu'une suite de DELETE ne ferait pas sans se tromper. CASCADE ramasse les
-- tables filles (planet_buildings, planet_ships, planet_defenses,
-- planet_biomes, asteroid_deposits, build_queue, colonization_processes,
-- market_offers, flagships) — elles sont tout de même listées ici, pour que
-- lire ce script suffise à savoir ce qui disparaît.
--
-- ⚠️ Une seule table est volontairement absente et mérite une décision :
--    `messages` (1506 lignes) — ce sont des conversations entre amis, pas de
--    l'état de jeu. Elles survivent. Si l'on veut repartir de zéro sur tout,
--    l'ajouter à la liste.

TRUNCATE TABLE
  -- La carte
  planets,
  planet_buildings,
  planet_ships,
  planet_defenses,
  planet_biomes,
  asteroid_belts,
  asteroid_deposits,
  debris_fields,
  discovered_positions,
  discovered_biomes,

  -- Les flottes et ce qui est en vol
  fleet_events,
  fleet_presets,
  colonization_processes,
  build_queue,

  -- Les missions et leurs traces
  pve_missions,
  mission_center_state,
  mission_reports,
  exploration_reports,

  -- La progression du joueur
  user_research_levels,
  user_research_choices,
  empire_progression,
  empire_xp_log,
  empire_policies,
  user_exilium,
  exilium_log,
  flagships,
  flagship_cooldowns,
  tutorial_progress,

  -- Le groupe (les amitiés, elles, survivent : elles ne sont pas de l'état de jeu)
  alliances,
  alliance_members,
  alliance_applications,
  alliance_invitations,
  alliance_logs,

  -- Le marché et les journaux de partie
  market_offers,
  game_events,
  rankings
CASCADE;

-- ============================================================================
-- CE QUI EST GARDÉ
-- ============================================================================
--
--   Comptes et accès ... users, notification_preferences, push_subscriptions,
--                        refresh_tokens, email_verification_tokens,
--                        password_reset_tokens, login_events
--   Liens sociaux ...... friendships, messages
--   Suivi de Julien .... feedbacks, feedback_comments, feedback_votes
--                        (LA source des retours joueurs — ne jamais l'effacer)
--   Éditorial .......... changelogs, changelog_comments, announcements,
--                        homepage_content
--   Config-as-data ..... universe_config, production_config, planet_types,
--                        biome_definitions, entity_categories, bonus_definitions,
--                        building_/research_/ship_/defense_definitions et leurs
--                        prérequis, pirate_templates, mission_definitions,
--                        tutorial_chapters, tutorial_quest_definitions, ui_labels
--   Historique DB ...... _migrations, _migrations_state
--
-- ============================================================================
-- LE NOUVEAU MONDE — à régler AVANT de lancer
-- ============================================================================
--
-- Ces valeurs sont durables : depuis que le seed tourne en mode init
-- (`--force-overwrite` pour l'inverse), un déploiement ne les écrase plus.
--
-- ⚠️ Si l'on change les DIMENSIONS ici, les changer AUSSI dans
--    packages/db/src/game-config-data.ts. Sinon une base recréée de zéro
--    (staging refresh, machine de dev) repartirait sur l'ancienne taille, et
--    les deux univers divergeraient sans qu'on le voie.

-- INSERT ... ON CONFLICT et non UPDATE : sur une base dont le seed est
-- antérieur à l'ajout de ces clés, un simple UPDATE ne toucherait aucune ligne
-- et ne dirait rien. Le premier essai de ce script s'est fait arrêter par le
-- contrôle final pour cette raison exacte — le garde-fou a tenu, mais mieux
-- vaut que le script soit autosuffisant.

-- La graine. TOUTE valeur non nulle donne un monde neuf ; 0 reproduirait
-- l'ancienne carte case par case, ce qui est précisément ce qu'on fuit.
INSERT INTO universe_config (key, value) VALUES ('world_seed', to_jsonb(20260809))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- La carte a des bords : les exilés se sont posés au bord, les Premiers
-- tiennent le centre. 'ring' referme la carte sur elle-même.
INSERT INTO universe_config (key, value) VALUES ('topology', to_jsonb('bounded'::text))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Dimensions. À ajuster à l'effectif attendu — décision différée, laissée
-- telle quelle par défaut.
-- INSERT INTO universe_config (key, value) VALUES ('galaxies', to_jsonb(1))
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- INSERT INTO universe_config (key, value) VALUES ('systems', to_jsonb(50))
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Rythme. 1 = historique. Le seul levier mesuré comme homothétique.
-- INSERT INTO universe_config (key, value) VALUES ('economy_speed', to_jsonb(2))
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── Contrôle final ─────────────────────────────────────────────────────────
DO $$
DECLARE
  nb_users int;
  nb_planets int;
  graine text;
  topo text;
BEGIN
  SELECT count(*) INTO nb_users FROM users;
  SELECT count(*) INTO nb_planets FROM planets;
  SELECT value #>> '{}' INTO graine FROM universe_config WHERE key = 'world_seed';
  SELECT value #>> '{}' INTO topo FROM universe_config WHERE key = 'topology';

  IF nb_planets <> 0 THEN
    RAISE EXCEPTION 'Reset incomplet : % planetes subsistent.', nb_planets;
  END IF;
  IF nb_users = 0 THEN
    RAISE EXCEPTION 'Les comptes ont disparu — ce n est PAS le comportement attendu, on annule.';
  END IF;
  IF graine IS NULL OR graine = '0' THEN
    RAISE EXCEPTION 'world_seed vaut 0 : la carte neuve serait identique a l ancienne. On annule.';
  END IF;

  RAISE NOTICE '--------------------------------------------------------------';
  RAISE NOTICE 'RESET TERMINE';
  RAISE NOTICE '  comptes conserves : %', nb_users;
  RAISE NOTICE '  planetes          : % ', nb_planets;
  RAISE NOTICE '  world_seed        : %', graine;
  RAISE NOTICE '  topologie         : %', topo;
  RAISE NOTICE '  -> relancer PM2, puis verifier /health';
  RAISE NOTICE '--------------------------------------------------------------';
END $$;

COMMIT;
