/**
 * Droits RGPD de l'utilisateur sur ses propres données : portabilité (export) et effacement.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

const SHOW_STATUS = ["en cours", "à voir", "terminée", "abandonnée"] as const;
const MOVIE_STATUS = ["à voir", "vu"] as const;

export type UserExport = {
  format: "regeplaza-export";
  version: 1;
  exportedAt: string;
  account: { email: string; displayName: string; createdAt: string };
  shows: {
    tmdbId: number;
    name: string;
    status: string;
    favorite: boolean;
    rating: number | null;
    addedAt: string;
    watchedEpisodes: { season: number; number: number; name: string | null; watchedAt: string; plays: number }[];
  }[];
  movies: { tmdbId: number; title: string; status: string; rating: number | null; plays: number; watchedAt: string | null; addedAt: string }[];
  dismissedRecommendations: { kind: "movie" | "show"; tmdbId: number; at: string }[];
};

/** Toutes les données personnelles d'un utilisateur, lisibles et réimportables (JSON). Notes sur 10. */
export async function exportUserData(userId: number): Promise<UserExport | null> {
  const [account] = await db.execute<{ email: string; display_name: string; created_at: string }>(sql`
    SELECT email, display_name, created_at::text FROM users WHERE id = ${userId}`);
  if (!account) return null;

  const [shows, movies, dismissed] = await Promise.all([
    db.execute<{ show_id: number; name: string; status: number; favorite: boolean; rating: number | null; added_at: string; episodes: UserExport["shows"][number]["watchedEpisodes"] }>(sql`
      SELECT us.show_id, s.name, us.status, us.favorite, us.rating, us.added_at::text,
        coalesce((
          SELECT json_agg(json_build_object('season', e.season, 'number', e.number, 'name', e.name,
                                            'watchedAt', w.watched_at, 'plays', w.plays)
                          ORDER BY e.season, e.number)
          FROM watched_episodes w JOIN episodes e ON e.id = w.episode_id
          WHERE w.user_id = us.user_id AND w.show_id = us.show_id), '[]') AS episodes
      FROM user_shows us JOIN shows s ON s.id = us.show_id
      WHERE us.user_id = ${userId}
      ORDER BY s.name`),
    db.execute<{ movie_id: number; title: string; status: number; rating: number | null; plays: number; watched_at: string | null; added_at: string }>(sql`
      SELECT um.movie_id, m.title, um.status, um.rating, um.plays, um.watched_at::text, um.added_at::text
      FROM user_movies um JOIN movies m ON m.id = um.movie_id
      WHERE um.user_id = ${userId}
      ORDER BY m.title`),
    db.execute<{ kind: number; item_id: number; created_at: string }>(sql`
      SELECT kind, item_id, created_at::text FROM user_feedback WHERE user_id = ${userId} ORDER BY created_at`),
  ]);

  return {
    format: "regeplaza-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    account: { email: account.email, displayName: account.display_name, createdAt: account.created_at },
    shows: shows.map((s) => ({
      tmdbId: s.show_id,
      name: s.name,
      status: SHOW_STATUS[s.status] ?? String(s.status),
      favorite: s.favorite,
      rating: s.rating,
      addedAt: s.added_at,
      watchedEpisodes: s.episodes,
    })),
    movies: movies.map((m) => ({
      tmdbId: m.movie_id,
      title: m.title,
      status: MOVIE_STATUS[m.status] ?? String(m.status),
      rating: m.rating,
      plays: m.plays,
      watchedAt: m.watched_at,
      addedAt: m.added_at,
    })),
    dismissedRecommendations: dismissed.map((d) => ({ kind: d.kind === 0 ? "movie" : "show", tmdbId: d.item_id, at: d.created_at })),
  };
}

/**
 * Supprime le compte et toutes ses données (sessions, suivi, films, imports, avis sur les
 * recommandations) : les tables utilisateur sont en ON DELETE CASCADE depuis users.
 * Le catalogue partagé (séries, films, correspondances Letterboxd) ne contient aucune donnée personnelle.
 */
export async function deleteAccount(userId: number) {
  const rows = await db.execute(sql`DELETE FROM users WHERE id = ${userId} RETURNING id`);
  return rows.length === 1;
}
