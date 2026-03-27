CREATE TABLE "exilium_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"source" varchar(32) NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flagships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"planet_id" uuid NOT NULL,
	"name" varchar(32) DEFAULT 'Vaisseau amiral' NOT NULL,
	"description" varchar(256) DEFAULT '' NOT NULL,
	"base_speed" integer DEFAULT 80000 NOT NULL,
	"fuel_consumption" integer DEFAULT 1 NOT NULL,
	"cargo_capacity" integer DEFAULT 150 NOT NULL,
	"drive_type" varchar(32) DEFAULT 'combustion' NOT NULL,
	"weapons" integer DEFAULT 2 NOT NULL,
	"shield" integer DEFAULT 4 NOT NULL,
	"hull" integer DEFAULT 8 NOT NULL,
	"base_armor" integer DEFAULT 0 NOT NULL,
	"shot_count" integer DEFAULT 1 NOT NULL,
	"combat_category_id" varchar(32) DEFAULT 'support' NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"repair_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_exilium" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"last_daily_at" timestamp with time zone,
	"daily_quests" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "check_balance_positive" CHECK ("user_exilium"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "exilium_log" ADD CONSTRAINT "exilium_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagships" ADD CONSTRAINT "flagships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flagships" ADD CONSTRAINT "flagships_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exilium" ADD CONSTRAINT "user_exilium_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exilium_log_user_created_idx" ON "exilium_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "flagships_user_id_idx" ON "flagships" USING btree ("user_id");