CREATE TABLE "bonus_definitions" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"source_type" varchar(16) NOT NULL,
	"source_id" varchar(64) NOT NULL,
	"stat" varchar(64) NOT NULL,
	"percent_per_level" real NOT NULL,
	"category" varchar(64)
);
