CREATE TABLE "mission_center_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"next_discovery_at" timestamp with time zone NOT NULL,
	"last_dismiss_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planets" ADD COLUMN "planet_image_index" smallint;--> statement-breakpoint
ALTER TABLE "mission_center_state" ADD CONSTRAINT "mission_center_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;