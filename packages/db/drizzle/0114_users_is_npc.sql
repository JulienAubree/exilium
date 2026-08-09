-- ============================================================================
-- 0114 — `is_npc` sur users : les capitaines des Premiers sont des comptes
-- ============================================================================
--
-- Les systèmes tenus par les Premiers sont de vrais empires : des planètes,
-- des flottes, des défenses, un bouclier planétaire. Or `planets.user_id` est
-- NOT NULL avec clé étrangère vers `users` — une planète sans propriétaire
-- n'existe pas dans ce schéma. Deux voies étaient possibles ; celle retenue
-- (cf. encadré 3.4 du plan de rework) fait de chaque capitaine une ligne
-- `users`. Tout le code existant de flotte, de combat et d'espionnage
-- fonctionne alors sans une ligne de plus.
--
-- Le prix, c'est ce drapeau. Sans lui, un capitaine pirate apparaîtrait dans
-- les classements, dans le fil de l'univers, dans le compteur de joueurs et
-- dans le back-office, mêlé aux amis de Julien.
--
-- ⚠️ Cette migration passe AVANT toute création de capitaine, et avant la
-- migration de la carte neuve. Poser le drapeau après coup obligerait à
-- rattraper chaque requête déjà écrite en le supposant absent — la dette
-- serait la même, mais payée en bugs plutôt qu'en une colonne.
--
-- Le problème existe déjà en miniature : `scripts/ensure-debug-bot.sh` crée
-- son robot avec `is_admin = true`, faute de meilleur moyen de le marquer
-- comme non-joueur. Il basculera sur ce drapeau.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_npc boolean NOT NULL DEFAULT false;

-- Index partiel : toutes les requêtes de listing de joueurs vont filtrer
-- `WHERE NOT is_npc`, et les NPC resteront très minoritaires. Un index sur les
-- seules lignes NPC sert les jointures inverses (lister les capitaines) sans
-- alourdir les écritures sur les comptes réels.
CREATE INDEX IF NOT EXISTS users_is_npc_idx ON users (is_npc) WHERE is_npc;

COMMENT ON COLUMN users.is_npc IS
  'Compte non-joueur (capitaine des Premiers, robot de debug). A exclure des classements, du fil de l''univers, des compteurs de joueurs et de l''administration.';
