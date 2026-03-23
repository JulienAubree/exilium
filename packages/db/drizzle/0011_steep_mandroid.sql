CREATE TABLE "mission_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"label" varchar(128) NOT NULL,
	"hint" text DEFAULT '' NOT NULL,
	"button_label" varchar(64) DEFAULT '' NOT NULL,
	"color" varchar(16) DEFAULT '#888888' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"dangerous" boolean DEFAULT false NOT NULL,
	"required_ship_roles" jsonb DEFAULT 'null'::jsonb,
	"exclusive" boolean DEFAULT false NOT NULL,
	"recommended_ship_roles" jsonb DEFAULT 'null'::jsonb,
	"requires_pve_mission" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ui_labels" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bonus_definitions" ADD COLUMN "stat_label" varchar(128);--> statement-breakpoint
ALTER TABLE "ship_definitions" ADD COLUMN "mining_extraction" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tutorial_quest_definitions" ADD COLUMN "condition_label" varchar(128);