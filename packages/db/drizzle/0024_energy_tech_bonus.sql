-- Add energy tech bonus: +2% energy production per level
INSERT INTO "bonus_definitions" ("id", "source_type", "source_id", "stat", "percent_per_level", "category", "stat_label")
VALUES ('energyTech__energy_production', 'research', 'energyTech', 'energy_production', 2, NULL, 'Production d''énergie')
ON CONFLICT ("id") DO NOTHING;

-- Update energyTech effect description to mention the bonus
UPDATE "research_definitions"
SET "effect_description" = 'Chaque niveau augmente la production d''energie de 2%. Prerequis pour les technologies de propulsion avancees.'
WHERE "id" = 'energyTech';
