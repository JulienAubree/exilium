-- Lot 2 PR-B : teardown de la table large user_research.
-- Les niveaux de recherche vivent désormais uniquement dans user_research_levels
-- (modèle en lignes). PR-A a re-pointé toutes les lectures ; le dual-write a été
-- retiré dans ce lot. La table large n'est plus ni lue ni écrite → drop.
-- Aucune autre table ne référence user_research (la FK est user_research.user_id
-- → users, pas l'inverse).

DROP TABLE IF EXISTS "user_research";
