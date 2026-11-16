ALTER TABLE "import_items" ADD COLUMN "show_id" integer;--> statement-breakpoint
ALTER TABLE "letterboxd_matches" ADD COLUMN "show_id" integer;--> statement-breakpoint
-- Le cache a été rempli par l'ancien algorithme, qui prenait des mini-séries pour des films
-- (« Loki » -> un court-métrage des Simpson). On le vide : il se reconstruit au prochain import.
DELETE FROM "letterboxd_matches";
