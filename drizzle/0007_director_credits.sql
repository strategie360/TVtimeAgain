CREATE TABLE "director_credits" (
	"person_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	CONSTRAINT "director_credits_person_id_movie_id_pk" PRIMARY KEY("person_id","movie_id")
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "credits_fetched_at" timestamp with time zone;