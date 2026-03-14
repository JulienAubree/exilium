CREATE TYPE "public"."alliance_role" AS ENUM('founder', 'officer', 'member');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."build_queue_status" AS ENUM('active', 'queued', 'completed');--> statement-breakpoint
CREATE TYPE "public"."build_queue_type" AS ENUM('building', 'research', 'ship', 'defense');--> statement-breakpoint
CREATE TYPE "public"."fleet_mission" AS ENUM('transport', 'station', 'spy', 'attack', 'colonize', 'recycle');--> statement-breakpoint
CREATE TYPE "public"."fleet_phase" AS ENUM('outbound', 'return');--> statement-breakpoint
CREATE TYPE "public"."fleet_status" AS ENUM('active', 'completed', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."planet_type" AS ENUM('planet', 'moon');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('system', 'colonization', 'player', 'espionage', 'combat', 'alliance');--> statement-breakpoint
CREATE TABLE "alliance_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alliance_id" uuid NOT NULL,
	"applicant_user_id" uuid NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliance_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alliance_id" uuid NOT NULL,
	"invited_user_id" uuid NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliance_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alliance_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "alliance_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alliance_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "alliances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(30) NOT NULL,
	"tag" varchar(8) NOT NULL,
	"description" text,
	"founder_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alliances_name_unique" UNIQUE("name"),
	CONSTRAINT "alliances_tag_unique" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "build_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "build_queue_type" NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "build_queue_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debris_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"galaxy" smallint NOT NULL,
	"system" smallint NOT NULL,
	"position" smallint NOT NULL,
	"metal" numeric(20, 2) DEFAULT '0' NOT NULL,
	"crystal" numeric(20, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"origin_planet_id" uuid NOT NULL,
	"target_planet_id" uuid,
	"target_galaxy" smallint NOT NULL,
	"target_system" smallint NOT NULL,
	"target_position" smallint NOT NULL,
	"mission" "fleet_mission" NOT NULL,
	"phase" "fleet_phase" DEFAULT 'outbound' NOT NULL,
	"status" "fleet_status" DEFAULT 'active' NOT NULL,
	"departure_time" timestamp with time zone NOT NULL,
	"arrival_time" timestamp with time zone NOT NULL,
	"metal_cargo" numeric(20, 2) DEFAULT '0' NOT NULL,
	"crystal_cargo" numeric(20, 2) DEFAULT '0' NOT NULL,
	"deuterium_cargo" numeric(20, 2) DEFAULT '0' NOT NULL,
	"ships" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "planets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(64) DEFAULT 'Homeworld' NOT NULL,
	"renamed" boolean DEFAULT false NOT NULL,
	"galaxy" smallint NOT NULL,
	"system" smallint NOT NULL,
	"position" smallint NOT NULL,
	"planet_type" "planet_type" DEFAULT 'planet' NOT NULL,
	"diameter" integer NOT NULL,
	"max_fields" integer NOT NULL,
	"min_temp" smallint NOT NULL,
	"max_temp" smallint NOT NULL,
	"metal" numeric(20, 2) DEFAULT '500' NOT NULL,
	"crystal" numeric(20, 2) DEFAULT '500' NOT NULL,
	"deuterium" numeric(20, 2) DEFAULT '0' NOT NULL,
	"resources_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metal_mine_level" smallint DEFAULT 0 NOT NULL,
	"crystal_mine_level" smallint DEFAULT 0 NOT NULL,
	"deut_synth_level" smallint DEFAULT 0 NOT NULL,
	"solar_plant_level" smallint DEFAULT 0 NOT NULL,
	"robotics_level" smallint DEFAULT 0 NOT NULL,
	"shipyard_level" smallint DEFAULT 0 NOT NULL,
	"research_lab_level" smallint DEFAULT 0 NOT NULL,
	"storage_metal_level" smallint DEFAULT 0 NOT NULL,
	"storage_crystal_level" smallint DEFAULT 0 NOT NULL,
	"storage_deut_level" smallint DEFAULT 0 NOT NULL,
	"metal_mine_percent" smallint DEFAULT 100 NOT NULL,
	"crystal_mine_percent" smallint DEFAULT 100 NOT NULL,
	"deut_synth_percent" smallint DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_research" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"espionage_tech" smallint DEFAULT 0 NOT NULL,
	"computer_tech" smallint DEFAULT 0 NOT NULL,
	"energy_tech" smallint DEFAULT 0 NOT NULL,
	"combustion" smallint DEFAULT 0 NOT NULL,
	"impulse" smallint DEFAULT 0 NOT NULL,
	"hyperspace_drive" smallint DEFAULT 0 NOT NULL,
	"weapons" smallint DEFAULT 0 NOT NULL,
	"shielding" smallint DEFAULT 0 NOT NULL,
	"armor" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planet_ships" (
	"planet_id" uuid PRIMARY KEY NOT NULL,
	"small_cargo" integer DEFAULT 0 NOT NULL,
	"large_cargo" integer DEFAULT 0 NOT NULL,
	"light_fighter" integer DEFAULT 0 NOT NULL,
	"heavy_fighter" integer DEFAULT 0 NOT NULL,
	"cruiser" integer DEFAULT 0 NOT NULL,
	"battleship" integer DEFAULT 0 NOT NULL,
	"espionage_probe" integer DEFAULT 0 NOT NULL,
	"colony_ship" integer DEFAULT 0 NOT NULL,
	"recycler" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planet_defenses" (
	"planet_id" uuid PRIMARY KEY NOT NULL,
	"rocket_launcher" integer DEFAULT 0 NOT NULL,
	"light_laser" integer DEFAULT 0 NOT NULL,
	"heavy_laser" integer DEFAULT 0 NOT NULL,
	"gauss_cannon" integer DEFAULT 0 NOT NULL,
	"plasma_turret" integer DEFAULT 0 NOT NULL,
	"small_shield" integer DEFAULT 0 NOT NULL,
	"large_shield" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid,
	"recipient_id" uuid NOT NULL,
	"type" "message_type" DEFAULT 'system' NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"read_by_sender" boolean DEFAULT false NOT NULL,
	"thread_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rankings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "alliance_applications" ADD CONSTRAINT "alliance_applications_alliance_id_alliances_id_fk" FOREIGN KEY ("alliance_id") REFERENCES "public"."alliances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_applications" ADD CONSTRAINT "alliance_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_invitations" ADD CONSTRAINT "alliance_invitations_alliance_id_alliances_id_fk" FOREIGN KEY ("alliance_id") REFERENCES "public"."alliances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_invitations" ADD CONSTRAINT "alliance_invitations_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_invitations" ADD CONSTRAINT "alliance_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_members" ADD CONSTRAINT "alliance_members_alliance_id_alliances_id_fk" FOREIGN KEY ("alliance_id") REFERENCES "public"."alliances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_members" ADD CONSTRAINT "alliance_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliances" ADD CONSTRAINT "alliances_founder_id_users_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_queue" ADD CONSTRAINT "build_queue_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_queue" ADD CONSTRAINT "build_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_events" ADD CONSTRAINT "fleet_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_events" ADD CONSTRAINT "fleet_events_origin_planet_id_planets_id_fk" FOREIGN KEY ("origin_planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet_events" ADD CONSTRAINT "fleet_events_target_planet_id_planets_id_fk" FOREIGN KEY ("target_planet_id") REFERENCES "public"."planets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_research" ADD CONSTRAINT "user_research_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_ships" ADD CONSTRAINT "planet_ships_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_defenses" ADD CONSTRAINT "planet_defenses_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_alliance_application" ON "alliance_applications" USING btree ("alliance_id","applicant_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_alliance_invitation" ON "alliance_invitations" USING btree ("alliance_id","invited_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "debris_fields_coords_idx" ON "debris_fields" USING btree ("galaxy","system","position");--> statement-breakpoint
CREATE INDEX "fleet_events_arrival_idx" ON "fleet_events" USING btree ("arrival_time") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "fleet_events_user_idx" ON "fleet_events" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_coordinates" ON "planets" USING btree ("galaxy","system","position","planet_type");--> statement-breakpoint
CREATE INDEX "messages_recipient_idx" ON "messages" USING btree ("recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "rankings_rank_idx" ON "rankings" USING btree ("rank");