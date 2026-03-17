ALTER TYPE "public"."fleet_mission" ADD VALUE 'mine';--> statement-breakpoint
ALTER TYPE "public"."fleet_mission" ADD VALUE 'pirate';--> statement-breakpoint
CREATE TABLE "asteroid_belts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"galaxy" smallint NOT NULL,
	"system" smallint NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asteroid_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"belt_id" uuid NOT NULL,
	"resource_type" varchar(32) NOT NULL,
	"total_quantity" numeric(20, 2) NOT NULL,
	"remaining_quantity" numeric(20, 2) NOT NULL,
	"regenerates_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "building_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_cost_minerai" integer DEFAULT 0 NOT NULL,
	"base_cost_silicium" integer DEFAULT 0 NOT NULL,
	"base_cost_hydrogene" integer DEFAULT 0 NOT NULL,
	"cost_factor" real DEFAULT 1.5 NOT NULL,
	"base_time" integer DEFAULT 60 NOT NULL,
	"build_time_reduction_factor" real,
	"reduces_time_for_category" varchar(64),
	"category_id" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "building_prerequisites" (
	"building_id" varchar(64) NOT NULL,
	"required_building_id" varchar(64) NOT NULL,
	"required_level" integer NOT NULL,
	CONSTRAINT "building_prerequisites_building_id_required_building_id_pk" PRIMARY KEY("building_id","required_building_id")
);
--> statement-breakpoint
CREATE TABLE "defense_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cost_minerai" integer DEFAULT 0 NOT NULL,
	"cost_silicium" integer DEFAULT 0 NOT NULL,
	"cost_hydrogene" integer DEFAULT 0 NOT NULL,
	"count_column" varchar(64) NOT NULL,
	"weapons" integer DEFAULT 0 NOT NULL,
	"shield" integer DEFAULT 0 NOT NULL,
	"armor" integer DEFAULT 0 NOT NULL,
	"max_per_planet" integer,
	"category_id" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "defense_prerequisites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "defense_prerequisites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"defense_id" varchar(64) NOT NULL,
	"required_building_id" varchar(64),
	"required_research_id" varchar(64),
	"required_level" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_categories" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"entity_type" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planet_types" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"positions" jsonb NOT NULL,
	"minerai_bonus" real DEFAULT 1 NOT NULL,
	"silicium_bonus" real DEFAULT 1 NOT NULL,
	"hydrogene_bonus" real DEFAULT 1 NOT NULL,
	"diameter_min" integer NOT NULL,
	"diameter_max" integer NOT NULL,
	"fields_bonus" real DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_config" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"base_production" real NOT NULL,
	"exponent_base" real DEFAULT 1.1 NOT NULL,
	"energy_consumption" real,
	"storage_base" real
);
--> statement-breakpoint
CREATE TABLE "rapid_fire" (
	"attacker_id" varchar(64) NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "rapid_fire_attacker_id_target_id_pk" PRIMARY KEY("attacker_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "research_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_cost_minerai" integer DEFAULT 0 NOT NULL,
	"base_cost_silicium" integer DEFAULT 0 NOT NULL,
	"base_cost_hydrogene" integer DEFAULT 0 NOT NULL,
	"cost_factor" real DEFAULT 2 NOT NULL,
	"level_column" varchar(64) NOT NULL,
	"category_id" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_prerequisites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "research_prerequisites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"research_id" varchar(64) NOT NULL,
	"required_building_id" varchar(64),
	"required_research_id" varchar(64),
	"required_level" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ship_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cost_minerai" integer DEFAULT 0 NOT NULL,
	"cost_silicium" integer DEFAULT 0 NOT NULL,
	"cost_hydrogene" integer DEFAULT 0 NOT NULL,
	"count_column" varchar(64) NOT NULL,
	"base_speed" integer DEFAULT 0 NOT NULL,
	"fuel_consumption" integer DEFAULT 0 NOT NULL,
	"cargo_capacity" integer DEFAULT 0 NOT NULL,
	"drive_type" varchar(32) DEFAULT 'combustion' NOT NULL,
	"weapons" integer DEFAULT 0 NOT NULL,
	"shield" integer DEFAULT 0 NOT NULL,
	"armor" integer DEFAULT 0 NOT NULL,
	"category_id" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ship_prerequisites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ship_prerequisites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"ship_id" varchar(64) NOT NULL,
	"required_building_id" varchar(64),
	"required_research_id" varchar(64),
	"required_level" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universe_config" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"planet_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planet_buildings" (
	"planet_id" uuid NOT NULL,
	"building_id" varchar(64) NOT NULL,
	"level" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "planet_buildings_planet_id_building_id_pk" PRIMARY KEY("planet_id","building_id")
);
--> statement-breakpoint
CREATE TABLE "pirate_templates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"tier" varchar(16) NOT NULL,
	"ships" jsonb NOT NULL,
	"techs" jsonb NOT NULL,
	"rewards" jsonb NOT NULL,
	"center_level_min" integer NOT NULL,
	"center_level_max" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pve_missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mission_type" varchar(32) NOT NULL,
	"parameters" jsonb DEFAULT '{}' NOT NULL,
	"rewards" jsonb DEFAULT '{}' NOT NULL,
	"difficulty_tier" varchar(16),
	"status" varchar(16) DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "debris_fields" ADD COLUMN "minerai" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "debris_fields" ADD COLUMN "silicium" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet_events" ADD COLUMN "minerai_cargo" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet_events" ADD COLUMN "silicium_cargo" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet_events" ADD COLUMN "hydrogene_cargo" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet_events" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "fleet_events" ADD COLUMN "pve_mission_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "planet_class_id" varchar(64);--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "minerai" numeric(20, 2) DEFAULT '500' NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "silicium" numeric(20, 2) DEFAULT '500' NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "hydrogene" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "minerai_mine_percent" smallint DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "silicium_mine_percent" smallint DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "hydrogene_synth_percent" smallint DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "planet_ships" ADD COLUMN "prospector" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "planet_ships" ADD COLUMN "explorer" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "asteroid_deposits" ADD CONSTRAINT "asteroid_deposits_belt_id_asteroid_belts_id_fk" FOREIGN KEY ("belt_id") REFERENCES "public"."asteroid_belts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_definitions" ADD CONSTRAINT "building_definitions_reduces_time_for_category_entity_categories_id_fk" FOREIGN KEY ("reduces_time_for_category") REFERENCES "public"."entity_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_definitions" ADD CONSTRAINT "building_definitions_category_id_entity_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."entity_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_prerequisites" ADD CONSTRAINT "building_prerequisites_building_id_building_definitions_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."building_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_prerequisites" ADD CONSTRAINT "building_prerequisites_required_building_id_building_definitions_id_fk" FOREIGN KEY ("required_building_id") REFERENCES "public"."building_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defense_definitions" ADD CONSTRAINT "defense_definitions_category_id_entity_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."entity_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defense_prerequisites" ADD CONSTRAINT "defense_prerequisites_defense_id_defense_definitions_id_fk" FOREIGN KEY ("defense_id") REFERENCES "public"."defense_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defense_prerequisites" ADD CONSTRAINT "defense_prerequisites_required_building_id_building_definitions_id_fk" FOREIGN KEY ("required_building_id") REFERENCES "public"."building_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defense_prerequisites" ADD CONSTRAINT "defense_prerequisites_required_research_id_research_definitions_id_fk" FOREIGN KEY ("required_research_id") REFERENCES "public"."research_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_definitions" ADD CONSTRAINT "research_definitions_category_id_entity_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."entity_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_prerequisites" ADD CONSTRAINT "research_prerequisites_research_id_research_definitions_id_fk" FOREIGN KEY ("research_id") REFERENCES "public"."research_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_prerequisites" ADD CONSTRAINT "research_prerequisites_required_building_id_building_definitions_id_fk" FOREIGN KEY ("required_building_id") REFERENCES "public"."building_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_prerequisites" ADD CONSTRAINT "research_prerequisites_required_research_id_research_definitions_id_fk" FOREIGN KEY ("required_research_id") REFERENCES "public"."research_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_definitions" ADD CONSTRAINT "ship_definitions_category_id_entity_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."entity_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_prerequisites" ADD CONSTRAINT "ship_prerequisites_ship_id_ship_definitions_id_fk" FOREIGN KEY ("ship_id") REFERENCES "public"."ship_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_prerequisites" ADD CONSTRAINT "ship_prerequisites_required_building_id_building_definitions_id_fk" FOREIGN KEY ("required_building_id") REFERENCES "public"."building_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_prerequisites" ADD CONSTRAINT "ship_prerequisites_required_research_id_research_definitions_id_fk" FOREIGN KEY ("required_research_id") REFERENCES "public"."research_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_buildings" ADD CONSTRAINT "planet_buildings_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pve_missions" ADD CONSTRAINT "pve_missions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_belt_coords" ON "asteroid_belts" USING btree ("galaxy","system","position");--> statement-breakpoint
CREATE INDEX "deposits_belt_remaining_idx" ON "asteroid_deposits" USING btree ("belt_id","remaining_quantity");--> statement-breakpoint
CREATE INDEX "game_events_user_read_date_idx" ON "game_events" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE INDEX "game_events_planet_date_idx" ON "game_events" USING btree ("planet_id","created_at");--> statement-breakpoint
CREATE INDEX "pve_missions_user_status_idx" ON "pve_missions" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "fleet_events" ADD CONSTRAINT "fleet_events_pve_mission_id_pve_missions_id_fk" FOREIGN KEY ("pve_mission_id") REFERENCES "public"."pve_missions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_planet_class_id_planet_types_id_fk" FOREIGN KEY ("planet_class_id") REFERENCES "public"."planet_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debris_fields" DROP COLUMN "metal";--> statement-breakpoint
ALTER TABLE "debris_fields" DROP COLUMN "crystal";--> statement-breakpoint
ALTER TABLE "fleet_events" DROP COLUMN "metal_cargo";--> statement-breakpoint
ALTER TABLE "fleet_events" DROP COLUMN "crystal_cargo";--> statement-breakpoint
ALTER TABLE "fleet_events" DROP COLUMN "deuterium_cargo";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "metal";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "crystal";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "deuterium";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "metal_mine_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "crystal_mine_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "deut_synth_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "solar_plant_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "robotics_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "shipyard_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "research_lab_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "storage_metal_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "storage_crystal_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "storage_deut_level";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "metal_mine_percent";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "crystal_mine_percent";--> statement-breakpoint
ALTER TABLE "planets" DROP COLUMN "deut_synth_percent";