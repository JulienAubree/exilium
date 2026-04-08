-- Add sort_order column to planets table
ALTER TABLE "planets" ADD COLUMN "sort_order" smallint NOT NULL DEFAULT 0;

-- Initialize existing planets with sequential sort order per user
UPDATE "planets" AS p
SET "sort_order" = sub.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC)) - 1 AS rn
  FROM "planets"
) AS sub
WHERE p.id = sub.id;
