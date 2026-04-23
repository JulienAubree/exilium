CREATE TABLE IF NOT EXISTS "alliance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alliance_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"visibility" varchar(16) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "alliance_logs" ADD CONSTRAINT "alliance_logs_alliance_id_alliances_id_fk"
 FOREIGN KEY ("alliance_id") REFERENCES "public"."alliances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "alliance_logs_alliance_created_idx"
  ON "alliance_logs" USING btree ("alliance_id","created_at");
