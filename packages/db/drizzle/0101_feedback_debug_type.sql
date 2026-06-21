-- Ajoute la catégorie « debug » aux feedbacks : retours automatiques postés par
-- le compte superviseur « Debug bot » (bots de test UX). Additif, non destructif.
-- PG 12+ autorise ADD VALUE hors/dans transaction tant qu'on ne l'utilise pas
-- dans la même transaction (ici on ne fait qu'ajouter la valeur).
ALTER TYPE feedback_type ADD VALUE IF NOT EXISTS 'debug';
