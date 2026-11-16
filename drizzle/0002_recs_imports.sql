CREATE TABLE "import_items" (
	"import_id" integer NOT NULL,
	"idx" integer NOT NULL,
	"name" text NOT NULL,
	"year" smallint,
	"watched" boolean NOT NULL,
	"watched_at" date,
	"rating" smallint,
	"plays" smallint DEFAULT 1 NOT NULL,
	"movie_id" integer,
	"state" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "import_items_import_id_idx_pk" PRIMARY KEY("import_id","idx")
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "imports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"source" text NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"matched" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "item_links" (
	"src_kind" smallint NOT NULL,
	"src_id" integer NOT NULL,
	"source" smallint NOT NULL,
	"dst_kind" smallint NOT NULL,
	"dst_id" integer NOT NULL,
	"score" real NOT NULL,
	CONSTRAINT "item_links_src_kind_src_id_source_dst_kind_dst_id_pk" PRIMARY KEY("src_kind","src_id","source","dst_kind","dst_id")
);
--> statement-breakpoint
CREATE TABLE "letterboxd_matches" (
	"key" text PRIMARY KEY NOT NULL,
	"movie_id" integer,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_fetches" (
	"kind" smallint NOT NULL,
	"id" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_fetches_kind_id_pk" PRIMARY KEY("kind","id")
);
--> statement-breakpoint
CREATE TABLE "media_summary" (
	"kind" smallint NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"poster_path" text,
	"year" smallint,
	"genre_ids" smallint[] DEFAULT '{}' NOT NULL,
	"vote_average" real DEFAULT 0 NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"popularity" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_summary_kind_id_pk" PRIMARY KEY("kind","id")
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"user_id" integer NOT NULL,
	"kind" smallint NOT NULL,
	"item_id" integer NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_feedback_user_id_kind_item_id_pk" PRIMARY KEY("user_id","kind","item_id")
);
--> statement-breakpoint
ALTER TABLE "user_movies" ADD COLUMN "rating" smallint;--> statement-breakpoint
ALTER TABLE "user_shows" ADD COLUMN "rating" smallint;--> statement-breakpoint
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imports_user_idx" ON "imports" USING btree ("user_id","created_at" DESC NULLS LAST);