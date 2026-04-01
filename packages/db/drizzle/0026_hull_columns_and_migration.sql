-- Add hull columns to flagships table
ALTER TABLE "flagships" ADD COLUMN "hull_id" varchar(32);
ALTER TABLE "flagships" ADD COLUMN "hull_changed_at" timestamp with time zone;
ALTER TABLE "flagships" ADD COLUMN "hull_change_available_at" timestamp with time zone;
ALTER TABLE "flagships" ADD COLUMN "refit_ends_at" timestamp with time zone;

-- Migrate existing flagships to industrial hull
UPDATE "flagships" SET "hull_id" = 'industrial' WHERE "hull_id" IS NULL;

-- Update playstyle for existing flagship owners
UPDATE "users" SET "playstyle" = 'miner'
WHERE "id" IN (SELECT "user_id" FROM "flagships" WHERE "hull_id" = 'industrial')
AND ("playstyle" IS NULL OR "playstyle" != 'miner');
