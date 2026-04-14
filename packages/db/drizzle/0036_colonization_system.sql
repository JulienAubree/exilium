-- Colonization system: add colonization_processes and colonization_events tables,
-- and add status column to planets.

CREATE TYPE "public"."colonization_status" AS ENUM('active', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."colonization_event_type" AS ENUM('raid', 'shortage');--> statement-breakpoint
CREATE TYPE "public"."colonization_event_status" AS ENUM('pending', 'resolved', 'expired');--> statement-breakpoint

CREATE TABLE "colonization_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"colony_ship_origin_planet_id" uuid NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"difficulty_factor" real DEFAULT 1 NOT NULL,
	"status" "colonization_status" DEFAULT 'active' NOT NULL,
	"last_tick_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "colonization_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_id" uuid NOT NULL,
	"event_type" "colonization_event_type" NOT NULL,
	"status" "colonization_event_status" DEFAULT 'pending' NOT NULL,
	"penalty" real NOT NULL,
	"resolve_bonus" real NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "planets" ADD COLUMN "status" varchar(32) DEFAULT 'active' NOT NULL;--> statement-breakpoint

ALTER TABLE "colonization_processes" ADD CONSTRAINT "colonization_processes_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colonization_processes" ADD CONSTRAINT "colonization_processes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colonization_events" ADD CONSTRAINT "colonization_events_process_id_colonization_processes_id_fk" FOREIGN KEY ("process_id") REFERENCES "public"."colonization_processes"("id") ON DELETE cascade ON UPDATE no action;
