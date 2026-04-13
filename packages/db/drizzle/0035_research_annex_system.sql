-- Research Annex System: add columns for planet-type building restrictions,
-- annex-required research, and 5 new exclusive research technologies.

ALTER TABLE "building_definitions" ADD COLUMN "allowed_planet_types" jsonb;--> statement-breakpoint
ALTER TABLE "research_definitions" ADD COLUMN "required_annex_type" varchar(64);--> statement-breakpoint
ALTER TABLE "user_research" ADD COLUMN "volcanic_weaponry" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_research" ADD COLUMN "arid_armor" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_research" ADD COLUMN "temperate_production" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_research" ADD COLUMN "glacial_shielding" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_research" ADD COLUMN "gaseous_propulsion" smallint DEFAULT 0 NOT NULL;
