-- universe_config : retrait des 8 cles `slag_rate` positionnelles.
--
-- Le modele de scories par position et par ressource a ete simplifie en un
-- taux unique par la migration 0020_simplify_slag_rate.sql. Ces cles ne sont
-- lues par aucun code depuis (verifie : 0 lecteur dans apps/ et packages/,
-- hors la liste de sections de l'admin, corrigee dans le meme lot).
--
-- Pourquoi elles sont encore la alors que 0008 et 0020 contenaient deja leur
-- DELETE : le bootstrap du 2026-04-10 s'etait contente d'enregistrer les noms
-- de fichiers dans `_migrations` sans executer leur contenu. apply-migrations.sh
-- execute reellement tout fichier absent de `_migrations`, donc ce DELETE-ci
-- s'appliquera vraiment. Les cles sont par ailleurs absentes de
-- seed-game-config.ts, le `db:seed` de deploy.sh ne les ressuscitera pas.
--
-- /!\ NE JAMAIS ecrire `DELETE ... WHERE key LIKE 'slag_rate%'` : la cle plate
-- `slag_rate` (0.5) est VIVANTE — lue par mine.handler.ts et par la page Fleet
-- cote web (6 references). On enumere.

DELETE FROM universe_config WHERE key IN (
  'slag_rate.pos8',
  'slag_rate.pos16',
  'slag_rate.pos8.minerai',
  'slag_rate.pos8.silicium',
  'slag_rate.pos8.hydrogene',
  'slag_rate.pos16.minerai',
  'slag_rate.pos16.silicium',
  'slag_rate.pos16.hydrogene'
);
