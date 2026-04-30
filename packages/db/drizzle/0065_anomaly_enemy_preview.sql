-- Anomalie : prévisualisation de l'ennemi du prochain nœud.
-- next_enemy_fleet est généré au moment où on entre dans la phase d'attente
-- (à engage et après chaque combat survived). Le client peut le lire pour
-- afficher la composition avant de cliquer "Lancer le combat".

ALTER TABLE "anomalies"
  ADD COLUMN IF NOT EXISTS "next_enemy_fleet" jsonb,
  ADD COLUMN IF NOT EXISTS "next_enemy_fp" integer;
