ALTER TABLE "research_definitions" ADD COLUMN IF NOT EXISTS "branch_id" varchar(32);
ALTER TABLE "research_definitions" ADD COLUMN IF NOT EXISTS "tier" smallint;
ALTER TABLE "research_definitions" ADD COLUMN IF NOT EXISTS "fork_id" varchar(64);
ALTER TABLE "research_definitions" ADD COLUMN IF NOT EXISTS "fork_path" varchar(32);
CREATE TABLE IF NOT EXISTS "user_research_choices" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "fork_id" varchar(64) NOT NULL,
  "chosen_path" varchar(32) NOT NULL,
  "respec_count" smallint NOT NULL DEFAULT 0,
  CONSTRAINT "user_research_choices_pkey" PRIMARY KEY ("user_id","fork_id")
);
