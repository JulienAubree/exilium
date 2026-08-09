-- ============================================================================
-- 0115 — `premier_systems` : les systèmes tenus par les Premiers
-- ============================================================================
--
-- Première entité NPC persistée sur la carte. Jusqu'ici le PvE n'existait que
-- sous forme de `pve_missions` éphémères, une instance par joueur, posée à une
-- coordonnée aléatoire et invisible pour tous les autres. Un front tenu à
-- plusieurs a besoin de l'inverse : un objet de monde, partagé, que chacun voit
-- au même endroit et dans le même état.
--
-- ── Ce que la table N'A PAS besoin de porter ────────────────────────────────
--
-- Les planètes du capitaine ne sont pas listées ici : elles sont des lignes
-- `planets` ordinaires dont le `user_id` est celui du capitaine (compte
-- `is_npc`, migration 0114). Le lien se fait par les coordonnées et la
-- propriété — donc flottes, défenses, bouclier planétaire, combat et
-- espionnage fonctionnent sans code neuf.
--
-- ── Le cycle ────────────────────────────────────────────────────────────────
--
--   held ──(garnison entamée)──> contested ──(garnison à zéro)──> liberated
--     ^                                                              │
--     └──────────────── returns_at atteint ◀──── window_ends_at ─────┘
--
-- La libération ouvre une FENÊTRE (bonus d'empire et/ou gisements
-- exceptionnels), puis les Premiers reviennent. Le retour n'est pas un échec de
-- conception : c'est le moteur du rendez-vous répétable, et ce qui empêche la
-- carte de se « finir ».
--
-- ── Pourquoi une garnison à état persistant ─────────────────────────────────
--
-- `garrison_remaining` se vide assaut après assaut, sur le modèle déjà éprouvé
-- des `asteroid_deposits` (extraction atomique, concurrency-safe). C'est ce qui
-- rend un siège JOUABLE À PLUSIEURS : trois amis qui frappent tour à tour font
-- un travail cumulatif, là où un combat tout-ou-rien exigerait qu'un seul
-- joueur soit assez fort. C'est aussi ce qui donne un coût à la défaite.

CREATE TABLE IF NOT EXISTS premier_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Coordonnées. Un système entier, pas une position : les Premiers tiennent
  -- le système, et leurs planètes y sont réparties.
  galaxy smallint NOT NULL,
  system smallint NOT NULL,

  -- Le capitaine. Ligne `users` marquée is_npc — son `username` EST le nom du
  -- domaine côté joueurs (« on tape Varek ce week-end »).
  captain_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Palier de difficulté, pour composer la garnison et calibrer la récompense.
  tier varchar(16) NOT NULL DEFAULT 'normal',

  state varchar(16) NOT NULL DEFAULT 'held',

  -- La garnison telle qu'elle est à plein, et ce qu'il en reste. Deux jsonb de
  -- forme Record<shipId, count>.
  garrison jsonb NOT NULL DEFAULT '{}'::jsonb,
  garrison_remaining jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Ce que la libération ouvre : bonus d'empire, gisements exceptionnels.
  -- Forme laissée libre le temps que la conception du lot 2 se fixe.
  reward jsonb NOT NULL DEFAULT '{}'::jsonb,

  liberated_at timestamptz,
  -- Fin de la fenêtre de bonus. Le système reste pris, mais cesse de rapporter.
  window_ends_at timestamptz,
  -- Retour des Premiers : l'état repasse à `held` et la garnison se recompose.
  returns_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT premier_systems_state_valide
    CHECK (state IN ('held', 'contested', 'liberated')),
  -- Un seul domaine par système : deux capitaines au même endroit n'auraient
  -- pas de sens, et la carte doit rester lisible.
  CONSTRAINT premier_systems_coords_uniques UNIQUE (galaxy, system)
);

-- Le fil de l'univers et l'écran du front demanderont « où en est le front ? »
-- à chaque affichage : l'état est le filtre naturel.
CREATE INDEX IF NOT EXISTS premier_systems_state_idx ON premier_systems (state);

-- Le cron de retour balaie les systèmes libérés dont l'échéance est passée.
CREATE INDEX IF NOT EXISTS premier_systems_returns_idx
  ON premier_systems (returns_at) WHERE returns_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS premier_systems_captain_idx ON premier_systems (captain_user_id);

COMMENT ON TABLE premier_systems IS
  'Systemes tenus par les Premiers. Les planetes du capitaine sont des lignes planets ordinaires (user_id = captain_user_id, compte is_npc) : le lien se fait par coordonnees et propriete.';
COMMENT ON COLUMN premier_systems.garrison_remaining IS
  'Ce qu il reste de la garnison. Se vide assaut apres assaut — c est ce qui rend un siege jouable a plusieurs et donne un cout a la defaite.';
