/**
 * Fiches légères des titres candidats (table media_summary) : affiche, genres, note et votes TMDB.
 * Partagées par les recommandations et la filmographie des réalisateurs.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { pgArray } from "./catalog";
import type { TmdbListItem } from "./tmdb";

export const toSummary = (kind: number, r: TmdbListItem) => ({
  kind,
  id: r.id,
  title: r.title ?? r.name ?? "",
  poster: r.poster_path,
  year: Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || null,
  genres: r.genre_ids ?? [],
  va: r.vote_average ?? 0,
  vc: r.vote_count ?? 0,
  pop: r.popularity ?? 0,
});

export async function upsertSummaries(rows: ReturnType<typeof toSummary>[]) {
  if (!rows.length) return;
  const uniq = [...new Map(rows.map((r) => [`${r.kind}:${r.id}`, r])).values()];
  await db.execute(sql`
    INSERT INTO media_summary (kind, id, title, poster_path, year, genre_ids, vote_average, vote_count, popularity, updated_at)
    SELECT k, i, t, p, y, coalesce(string_to_array(nullif(g, ''), ',')::smallint[], '{}'), va, vc, pop, now() FROM unnest(
      ${pgArray(uniq.map((r) => r.kind))}::smallint[], ${pgArray(uniq.map((r) => r.id))}::int[],
      ${pgArray(uniq.map((r) => r.title))}::text[], ${pgArray(uniq.map((r) => r.poster))}::text[],
      ${pgArray(uniq.map((r) => r.year))}::smallint[], ${pgArray(uniq.map((r) => r.genres.join(",")))}::text[],
      ${pgArray(uniq.map((r) => r.va))}::real[], ${pgArray(uniq.map((r) => r.vc))}::int[],
      ${pgArray(uniq.map((r) => r.pop))}::real[]) AS u(k, i, t, p, y, g, va, vc, pop)
    ON CONFLICT (kind, id) DO UPDATE SET title = excluded.title, poster_path = excluded.poster_path,
      year = excluded.year, genre_ids = excluded.genre_ids, vote_average = excluded.vote_average,
      vote_count = excluded.vote_count, popularity = excluded.popularity, updated_at = now()`);
}
