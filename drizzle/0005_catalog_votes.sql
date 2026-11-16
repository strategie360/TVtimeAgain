ALTER TABLE "movies" ADD COLUMN "vote_average" real;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "vote_count" integer;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "vote_average" real;--> statement-breakpoint
ALTER TABLE "shows" ADD COLUMN "vote_count" integer;--> statement-breakpoint
-- Remplissage immédiat depuis les fiches légères déjà connues (aucun appel TMDB).
-- Le reste est complété par le job quotidien (backfillVotes).
UPDATE "movies" m SET "vote_average" = ms.vote_average, "vote_count" = ms.vote_count
FROM "media_summary" ms WHERE ms.kind = 0 AND ms.id = m.id AND ms.vote_count > 0;--> statement-breakpoint
UPDATE "shows" s SET "vote_average" = ms.vote_average, "vote_count" = ms.vote_count
FROM "media_summary" ms WHERE ms.kind = 1 AND ms.id = s.id AND ms.vote_count > 0;
