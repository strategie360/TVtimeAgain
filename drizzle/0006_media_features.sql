CREATE TABLE "media_features" (
	"kind" smallint NOT NULL,
	"id" integer NOT NULL,
	"directors" integer[] DEFAULT '{}' NOT NULL,
	"cast" integer[] DEFAULT '{}' NOT NULL,
	"keywords" integer[] DEFAULT '{}' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_features_kind_id_pk" PRIMARY KEY("kind","id")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
