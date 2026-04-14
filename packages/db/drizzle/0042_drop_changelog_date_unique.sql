ALTER TABLE "changelogs" DROP CONSTRAINT IF EXISTS "changelogs_date_unique";
DROP INDEX IF EXISTS "changelogs_date_unique";
