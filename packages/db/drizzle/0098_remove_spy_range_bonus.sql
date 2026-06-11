-- Bonus fantôme : « Portée d'espionnage » (+100 %/niveau, espionageTech)
-- était défini et affiché sur la fiche recherche, mais consommé par AUCUNE
-- mécanique (aucune portée d'espionnage n'existe ; espionageTech sert au
-- duel de qualité des rapports, qui lui fonctionne). On retire l'entrée
-- plutôt que d'afficher une fiction. Réimplémentation éventuelle d'une
-- vraie portée = décision de game design séparée.
-- Le seed fait des upserts et ne supprime jamais → migration obligatoire
-- (règle CLAUDE.md).
DELETE FROM bonus_definitions WHERE id = 'espionageTech__spy_range';
