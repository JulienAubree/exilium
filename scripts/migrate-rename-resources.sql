-- Migration: Rename resources (metal→minerai, crystal→silicium, deuterium→hydrogene)
-- Run this BEFORE db:push to preserve existing data.

-- ══════════════════════════════════════════════
-- Table: planets
-- ══════════════════════════════════════════════
ALTER TABLE planets RENAME COLUMN metal TO minerai;
ALTER TABLE planets RENAME COLUMN crystal TO silicium;
ALTER TABLE planets RENAME COLUMN deuterium TO hydrogene;

ALTER TABLE planets RENAME COLUMN metal_mine_level TO minerai_mine_level;
ALTER TABLE planets RENAME COLUMN crystal_mine_level TO silicium_mine_level;
ALTER TABLE planets RENAME COLUMN deut_synth_level TO hydrogene_synth_level;

ALTER TABLE planets RENAME COLUMN storage_metal_level TO storage_minerai_level;
ALTER TABLE planets RENAME COLUMN storage_crystal_level TO storage_silicium_level;
ALTER TABLE planets RENAME COLUMN storage_deut_level TO storage_hydrogene_level;

ALTER TABLE planets RENAME COLUMN metal_mine_percent TO minerai_mine_percent;
ALTER TABLE planets RENAME COLUMN crystal_mine_percent TO silicium_mine_percent;
ALTER TABLE planets RENAME COLUMN deut_synth_percent TO hydrogene_synth_percent;

-- ══════════════════════════════════════════════
-- Table: fleet_events
-- ══════════════════════════════════════════════
ALTER TABLE fleet_events RENAME COLUMN metal_cargo TO minerai_cargo;
ALTER TABLE fleet_events RENAME COLUMN crystal_cargo TO silicium_cargo;
ALTER TABLE fleet_events RENAME COLUMN deuterium_cargo TO hydrogene_cargo;

-- ══════════════════════════════════════════════
-- Table: debris_fields
-- ══════════════════════════════════════════════
ALTER TABLE debris_fields RENAME COLUMN metal TO minerai;
ALTER TABLE debris_fields RENAME COLUMN crystal TO silicium;

-- ══════════════════════════════════════════════
-- Table: building_definitions
-- ══════════════════════════════════════════════
ALTER TABLE building_definitions RENAME COLUMN base_cost_metal TO base_cost_minerai;
ALTER TABLE building_definitions RENAME COLUMN base_cost_crystal TO base_cost_silicium;
ALTER TABLE building_definitions RENAME COLUMN base_cost_deuterium TO base_cost_hydrogene;

-- ══════════════════════════════════════════════
-- Table: research_definitions
-- ══════════════════════════════════════════════
ALTER TABLE research_definitions RENAME COLUMN base_cost_metal TO base_cost_minerai;
ALTER TABLE research_definitions RENAME COLUMN base_cost_crystal TO base_cost_silicium;
ALTER TABLE research_definitions RENAME COLUMN base_cost_deuterium TO base_cost_hydrogene;

-- ══════════════════════════════════════════════
-- Table: ship_definitions
-- ══════════════════════════════════════════════
ALTER TABLE ship_definitions RENAME COLUMN cost_metal TO cost_minerai;
ALTER TABLE ship_definitions RENAME COLUMN cost_crystal TO cost_silicium;
ALTER TABLE ship_definitions RENAME COLUMN cost_deuterium TO cost_hydrogene;

-- ══════════════════════════════════════════════
-- Table: defense_definitions
-- ══════════════════════════════════════════════
ALTER TABLE defense_definitions RENAME COLUMN cost_metal TO cost_minerai;
ALTER TABLE defense_definitions RENAME COLUMN cost_crystal TO cost_silicium;
ALTER TABLE defense_definitions RENAME COLUMN cost_deuterium TO cost_hydrogene;

-- ══════════════════════════════════════════════
-- Update building IDs (old → new)
-- ══════════════════════════════════════════════

-- Update building_definitions IDs
UPDATE building_definitions SET id = 'mineraiMine' WHERE id = 'metalMine';
UPDATE building_definitions SET id = 'siliciumMine' WHERE id = 'crystalMine';
UPDATE building_definitions SET id = 'hydrogeneSynth' WHERE id = 'deutSynth';
UPDATE building_definitions SET id = 'storageMinerai' WHERE id = 'storageMetal';
UPDATE building_definitions SET id = 'storageSilicium' WHERE id = 'storageCrystal';
UPDATE building_definitions SET id = 'storageHydrogene' WHERE id = 'storageDeut';

-- Update level_column values
UPDATE building_definitions SET level_column = 'mineraiMineLevel' WHERE level_column = 'metalMineLevel';
UPDATE building_definitions SET level_column = 'siliciumMineLevel' WHERE level_column = 'crystalMineLevel';
UPDATE building_definitions SET level_column = 'hydrogeneSynthLevel' WHERE level_column = 'deutSynthLevel';
UPDATE building_definitions SET level_column = 'storageMineraiLevel' WHERE level_column = 'storageMetalLevel';
UPDATE building_definitions SET level_column = 'storageSiliciumLevel' WHERE level_column = 'storageCrystalLevel';
UPDATE building_definitions SET level_column = 'storageHydrogeneLevel' WHERE level_column = 'storageDeutLevel';

-- Update building_prerequisites references
UPDATE building_prerequisites SET building_id = 'mineraiMine' WHERE building_id = 'metalMine';
UPDATE building_prerequisites SET building_id = 'siliciumMine' WHERE building_id = 'crystalMine';
UPDATE building_prerequisites SET building_id = 'hydrogeneSynth' WHERE building_id = 'deutSynth';
UPDATE building_prerequisites SET building_id = 'storageMinerai' WHERE building_id = 'storageMetal';
UPDATE building_prerequisites SET building_id = 'storageSilicium' WHERE building_id = 'storageCrystal';
UPDATE building_prerequisites SET building_id = 'storageHydrogene' WHERE building_id = 'storageDeut';

UPDATE building_prerequisites SET required_building_id = 'mineraiMine' WHERE required_building_id = 'metalMine';
UPDATE building_prerequisites SET required_building_id = 'siliciumMine' WHERE required_building_id = 'crystalMine';
UPDATE building_prerequisites SET required_building_id = 'hydrogeneSynth' WHERE required_building_id = 'deutSynth';
UPDATE building_prerequisites SET required_building_id = 'storageMinerai' WHERE required_building_id = 'storageMetal';
UPDATE building_prerequisites SET required_building_id = 'storageSilicium' WHERE required_building_id = 'storageCrystal';
UPDATE building_prerequisites SET required_building_id = 'storageHydrogene' WHERE required_building_id = 'storageDeut';

-- Update research_prerequisites building references
UPDATE research_prerequisites SET required_building_id = 'mineraiMine' WHERE required_building_id = 'metalMine';
UPDATE research_prerequisites SET required_building_id = 'siliciumMine' WHERE required_building_id = 'crystalMine';
UPDATE research_prerequisites SET required_building_id = 'hydrogeneSynth' WHERE required_building_id = 'deutSynth';

-- Update ship_prerequisites building references
UPDATE ship_prerequisites SET required_building_id = 'mineraiMine' WHERE required_building_id = 'metalMine';
UPDATE ship_prerequisites SET required_building_id = 'siliciumMine' WHERE required_building_id = 'crystalMine';
UPDATE ship_prerequisites SET required_building_id = 'hydrogeneSynth' WHERE required_building_id = 'deutSynth';

-- Update defense_prerequisites building references
UPDATE defense_prerequisites SET required_building_id = 'mineraiMine' WHERE required_building_id = 'metalMine';
UPDATE defense_prerequisites SET required_building_id = 'siliciumMine' WHERE required_building_id = 'crystalMine';
UPDATE defense_prerequisites SET required_building_id = 'hydrogeneSynth' WHERE required_building_id = 'deutSynth';

-- Update production_config IDs
UPDATE production_config SET id = 'mineraiMine' WHERE id = 'metalMine';
UPDATE production_config SET id = 'siliciumMine' WHERE id = 'crystalMine';
UPDATE production_config SET id = 'hydrogeneSynth' WHERE id = 'deutSynth';

-- Update build_queue references (if any active builds)
UPDATE build_queue SET building_id = 'mineraiMine' WHERE building_id = 'metalMine';
UPDATE build_queue SET building_id = 'siliciumMine' WHERE building_id = 'crystalMine';
UPDATE build_queue SET building_id = 'hydrogeneSynth' WHERE building_id = 'deutSynth';
UPDATE build_queue SET building_id = 'storageMinerai' WHERE building_id = 'storageMetal';
UPDATE build_queue SET building_id = 'storageSilicium' WHERE building_id = 'storageCrystal';
UPDATE build_queue SET building_id = 'storageHydrogene' WHERE building_id = 'storageDeut';
