-- Flagship: cargo capacity 100 -> 5000 (align with small cargo)
ALTER TABLE "flagships" ALTER COLUMN "cargo_capacity" SET DEFAULT 5000;

-- Flagship: replace image_id (varchar) with flagship_image_index (smallint)
ALTER TABLE "flagships" ADD COLUMN "flagship_image_index" smallint;
ALTER TABLE "flagships" DROP COLUMN IF EXISTS "image_id";
