DROP INDEX "deposits_belt_remaining_idx";--> statement-breakpoint
ALTER TABLE "asteroid_deposits" ADD COLUMN "minerai_total" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "asteroid_deposits" ADD COLUMN "minerai_remaining" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "asteroid_deposits" ADD COLUMN "silicium_total" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "asteroid_deposits" ADD COLUMN "silicium_remaining" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "asteroid_deposits" ADD COLUMN "hydrogene_total" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "asteroid_deposits" ADD COLUMN "hydrogene_remaining" numeric(20, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE INDEX "deposits_belt_idx" ON "asteroid_deposits" USING btree ("belt_id");--> statement-breakpoint
ALTER TABLE "asteroid_deposits" DROP COLUMN "resource_type";--> statement-breakpoint
ALTER TABLE "asteroid_deposits" DROP COLUMN "total_quantity";--> statement-breakpoint
ALTER TABLE "asteroid_deposits" DROP COLUMN "remaining_quantity";
