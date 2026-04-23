ALTER TABLE "alliance_members"
  ADD COLUMN "activity_seen_at" timestamp with time zone DEFAULT now() NOT NULL;
