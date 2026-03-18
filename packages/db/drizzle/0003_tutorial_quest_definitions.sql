CREATE TABLE "tutorial_quest_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"quest_order" integer NOT NULL,
	"title" varchar(128) NOT NULL,
	"narrative_text" text NOT NULL,
	"condition_type" varchar(32) NOT NULL,
	"condition_target_id" varchar(64) NOT NULL,
	"condition_target_value" integer NOT NULL,
	"reward_minerai" integer DEFAULT 0 NOT NULL,
	"reward_silicium" integer DEFAULT 0 NOT NULL,
	"reward_hydrogene" integer DEFAULT 0 NOT NULL
);
