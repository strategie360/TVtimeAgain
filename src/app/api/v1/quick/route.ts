import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api";
import { pgArray } from "@/lib/catalog";
import { fetchList } from "@/lib/tmdb";

/**
 * Sélection rapide : ?kind=movie|tv &list=most_voted|popular &page=n
 * Liste TMDB (en cache 24 h, identique pour tous) + 1 requête pour savoir
 * ce que l'utilisateur a déjà.
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") === "tv" ? "tv" : "movie";
  const list = sp.get("list") === "popular" ? "popular" : "most_voted";
  const page = Math.min(500, Math.max(1, Number(sp.get("page")) || 1));
  const r = await fetchList(kind, list, page);
  const ids = r.results.map((x) => x.id);
  const known = new Set(
    (kind === "movie"
      ? await db.execute<{ id: number }>(sql`SELECT movie_id AS id FROM user_movies WHERE user_id = ${user.id} AND status = 1 AND movie_id = ANY(${pgArray(ids)}::int[])`)
      : await db.execute<{ id: number }>(sql`SELECT show_id AS id FROM user_shows WHERE user_id = ${user.id} AND watched_count > 0 AND show_id = ANY(${pgArray(ids)}::int[])`)
    ).map((x) => x.id),
  );
  return {
    page,
    totalPages: Math.min(r.total_pages, 500),
    items: r.results.map((x) => ({
      id: x.id,
      title: x.title ?? x.name ?? "",
      year: (x.release_date ?? x.first_air_date ?? "").slice(0, 4) || null,
      poster_path: x.poster_path,
      seen: known.has(x.id),
    })),
  };
});
