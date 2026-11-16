CREATE TABLE "episodes" (
	"id" integer PRIMARY KEY NOT NULL,
	"show_id" integer NOT NULL,
	"season" smallint NOT NULL,
	"number" smallint NOT NULL,
	"name" text,
	"overview" text,
	"air_date" date,
	"runtime" smallint,
	"still_path" text
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"overview" text,
	"poster_path" text,
	"backdrop_path" text,
	"release_date" date,
	"runtime" smallint,
	"genre_ids" smallint[] DEFAULT '{}' NOT NULL,
	"popularity" real DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"overview" text,
	"poster_path" text,
	"backdrop_path" text,
	"first_air_date" date,
	"status" text,
	"network" text,
	"genre_ids" smallint[] DEFAULT '{}' NOT NULL,
	"episode_runtime" smallint,
	"season_count" smallint DEFAULT 0 NOT NULL,
	"aired_episodes" smallint DEFAULT 0 NOT NULL,
	"popularity" real DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_movies" (
	"user_id" integer NOT NULL,
	"movie_id" integer NOT NULL,
	"status" smallint NOT NULL,
	"plays" smallint DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watched_at" timestamp with time zone,
	CONSTRAINT "user_movies_user_id_movie_id_pk" PRIMARY KEY("user_id","movie_id")
);
--> statement-breakpoint
CREATE TABLE "user_shows" (
	"user_id" integer NOT NULL,
	"show_id" integer NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"watched_count" smallint DEFAULT 0 NOT NULL,
	"next_episode_id" integer,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_watched_at" timestamp with time zone,
	CONSTRAINT "user_shows_user_id_show_id_pk" PRIMARY KEY("user_id","show_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"episodes_watched" integer DEFAULT 0 NOT NULL,
	"episode_minutes" integer DEFAULT 0 NOT NULL,
	"movies_watched" integer DEFAULT 0 NOT NULL,
	"movie_minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watched_episodes" (
	"user_id" integer NOT NULL,
	"show_id" integer NOT NULL,
	"episode_id" integer NOT NULL,
	"watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plays" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "watched_episodes_user_id_show_id_episode_id_pk" PRIMARY KEY("user_id","show_id","episode_id")
);
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movies" ADD CONSTRAINT "user_movies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movies" ADD CONSTRAINT "user_movies_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_shows" ADD CONSTRAINT "user_shows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_shows" ADD CONSTRAINT "user_shows_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watched_episodes" ADD CONSTRAINT "watched_episodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_show_order_idx" ON "episodes" USING btree ("show_id","season","number");--> statement-breakpoint
CREATE INDEX "episodes_show_air_idx" ON "episodes" USING btree ("show_id","air_date");--> statement-breakpoint
CREATE INDEX "episodes_air_idx" ON "episodes" USING btree ("air_date");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shows_popularity_idx" ON "shows" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "user_movies_list_idx" ON "user_movies" USING btree ("user_id","status","added_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_shows_activity_idx" ON "user_shows" USING btree ("user_id","last_watched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_shows_show_idx" ON "user_shows" USING btree ("show_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree (lower("email"));