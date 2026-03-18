CREATE TABLE "tutorial_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_quest_id" varchar(64) DEFAULT 'quest_1' NOT NULL,
	"completed_quests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutorial_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
