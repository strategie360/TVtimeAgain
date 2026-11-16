/**
 * Lectures. Chaque écran = 1 requête (2 pour la fiche série), sans N+1,
 * en ne sélectionnant que les colonnes affichées. Aucun agrégat sur l'ensemble
 * des utilisateurs : tout est borné par user_id (préfixe de PK).
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { MovieStatus, ShowStatus } from "@/db/schema";

export type UpNextItem = {
  show_id: number;
  name: string;
  poster_path: string | null;
  watched_count: number;
  aired_episodes: number;
  episode_id: number | null;
  season: number | null;
  number: number | null;
  episode_name: string | null;
  air_date: string | null;
  still_path: string | null;
};

/** Écran d'accueil "À suivre" : 1 requête, jointure sur next_episode_id dénormalisé. */
export async function getUpNext(userId: number, limit = 50) {
  return db.execute<UpNextItem>(sql`
    SELECT us.show_id, s.name, s.poster_path, us.watched_count, s.aired_episodes,
           e.id AS episode_id, e.season, e.number, e.name AS episode_name, e.air_date, e.still_path
    FROM user_shows us
    JOIN shows s ON s.id = us.show_id
    LEFT JOIN episodes e ON e.id = us.next_episode_id
    WHERE us.user_id = ${userId} AND us.status = ${ShowStatus.watching}
    ORDER BY (e.air_date IS NOT NULL AND e.air_date <= current_date) DESC,
             us.last_watched_at DESC NULLS LAST
    LIMIT ${limit}`);
}

export type LibraryItem = {
  show_id: number;
  name: string;
  poster_path: string | null;
  status: number;
  favorite: boolean;
  watched_count: number;
  aired_episodes: number;
  show_status: string | null;
};

export async function getLibrary(userId: number) {
  return db.execute<LibraryItem>(sql`
    SELECT us.show_id, s.name, s.poster_path, us.status, us.favorite, us.watched_count,
           s.aired_episodes, s.status AS show_status
    FROM user_shows us JOIN shows s ON s.id = us.show_id
    WHERE us.user_id = ${userId}
    ORDER BY us.status, us.last_watched_at DESC NULLS LAST, s.name`);
}

export type CalendarItem = {
  episode_id: number;
  show_id: number;
  show_name: string;
  poster_path: string | null;
  season: number;
  number: number;
  episode_name: string | null;
  air_date: string;
  network: string | null;
};

/**
 * Calendrier : pour chaque série suivie, range scan sur (show_id, air_date).
 * Fenêtre bornée (max 92 jours) pour garder un coût prévisible.
 */
export async function getCalendar(userId: number, from: string, to: string) {
  return db.execute<CalendarItem>(sql`
    SELECT e.id AS episode_id, s.id AS show_id, s.name AS show_name, s.poster_path,
           e.season, e.number, e.name AS episode_name, e.air_date::text AS air_date, s.network
    FROM user_shows us
    JOIN shows s ON s.id = us.show_id
    JOIN episodes e ON e.show_id = us.show_id AND e.air_date BETWEEN ${from}::date AND ${to}::date
    WHERE us.user_id = ${userId} AND us.status IN (${ShowStatus.watching}, ${ShowStatus.planned})
      AND e.season > 0
    ORDER BY e.air_date, s.name, e.season, e.number`);
}

export type ShowDetail = {
  id: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  status: string | null;
  network: string | null;
  season_count: number;
  aired_episodes: number;
  episode_runtime: number | null;
  // jointure utilisateur (null si non suivie / non connecté)
  user_status: number | null;
  favorite: boolean | null;
  rating: number | null;
  watched_count: number | null;
  next_episode_id: number | null;
};

export type EpisodeRow = {
  id: number;
  season: number;
  number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  watched: boolean;
};

export async function getShowDetail(showId: number, userId: number | null) {
  const uid = userId ?? -1;
  const [[show], episodes] = await Promise.all([
    db.execute<ShowDetail>(sql`
      SELECT s.id, s.name, s.overview, s.poster_path, s.backdrop_path, s.first_air_date::text,
             s.status, s.network, s.season_count, s.aired_episodes, s.episode_runtime,
             us.status AS user_status, us.favorite, us.rating, us.watched_count, us.next_episode_id
      FROM shows s
      LEFT JOIN user_shows us ON us.show_id = s.id AND us.user_id = ${uid}
      WHERE s.id = ${showId}`),
    // LEFT JOIN sur la PK (user_id, show_id, episode_id) : coût ~ nb d'épisodes de la série.
    db.execute<EpisodeRow>(sql`
      SELECT e.id, e.season, e.number, e.name, e.overview, e.air_date::text, e.runtime,
             (w.episode_id IS NOT NULL) AS watched
      FROM episodes e
      LEFT JOIN watched_episodes w ON w.user_id = ${uid} AND w.show_id = e.show_id AND w.episode_id = e.id
      WHERE e.show_id = ${showId}
      ORDER BY e.season = 0, e.season, e.number`),
  ]);
  return show ? { show, episodes: [...episodes] } : null;
}

export type MovieItem = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  runtime: number | null;
  status: number;
  plays: number;
  watched_at: string | null;
};

export async function getMovies(userId: number) {
  return db.execute<MovieItem>(sql`
    SELECT m.id, m.title, m.poster_path, m.release_date::text, m.runtime,
           um.status, um.plays, um.watched_at::text
    FROM user_movies um JOIN movies m ON m.id = um.movie_id
    WHERE um.user_id = ${userId}
    ORDER BY um.status, coalesce(um.watched_at, um.added_at) DESC`);
}

export async function getMovieDetail(movieId: number, userId: number | null) {
  const [row] = await db.execute<
    MovieItem & { overview: string | null; backdrop_path: string | null; user_status: number | null; rating: number | null }
  >(sql`
    SELECT m.id, m.title, m.overview, m.poster_path, m.backdrop_path, m.release_date::text, m.runtime,
           um.status AS user_status, um.rating, coalesce(um.plays, 0) AS plays, um.watched_at::text
    FROM movies m
    LEFT JOIN user_movies um ON um.movie_id = m.id AND um.user_id = ${userId ?? -1}
    WHERE m.id = ${movieId}`);
  return row ?? null;
}

export type Stats = {
  episodes_watched: number;
  episode_minutes: number;
  movies_watched: number;
  movie_minutes: number;
  shows_followed: number;
  shows_completed: number;
  movies_watchlist: number;
  by_month: { month: string; episodes: number; minutes: number }[];
  top_shows: { show_id: number; name: string; poster_path: string | null; watched_count: number }[];
};

/**
 * Stats : les totaux viennent des compteurs dénormalisés (O(1)).
 * Seul l'historique mensuel lit watched_episodes, borné à 12 mois et à cet user.
 */
export async function getStats(userId: number): Promise<Stats> {
  const [row] = await db.execute<Stats>(sql`
    SELECT u.episodes_watched, u.episode_minutes, u.movies_watched, u.movie_minutes,
      (SELECT count(*)::int FROM user_shows WHERE user_id = u.id) AS shows_followed,
      (SELECT count(*)::int FROM user_shows WHERE user_id = u.id AND status = ${ShowStatus.completed}) AS shows_completed,
      (SELECT count(*)::int FROM user_movies WHERE user_id = u.id AND status = ${MovieStatus.watchlist}) AS movies_watchlist,
      coalesce((
        SELECT json_agg(x ORDER BY x.month) FROM (
          SELECT to_char(date_trunc('month', w.watched_at), 'YYYY-MM') AS month,
                 count(*)::int AS episodes,
                 sum(coalesce(e.runtime, s.episode_runtime, 0))::int AS minutes
          FROM watched_episodes w
          JOIN episodes e ON e.id = w.episode_id
          JOIN shows s ON s.id = w.show_id
          WHERE w.user_id = u.id AND w.watched_at >= date_trunc('month', now()) - interval '11 months'
          GROUP BY 1
        ) x), '[]') AS by_month,
      coalesce((
        SELECT json_agg(t) FROM (
          SELECT us.show_id, s.name, s.poster_path, us.watched_count
          FROM user_shows us JOIN shows s ON s.id = us.show_id
          WHERE us.user_id = u.id ORDER BY us.watched_count DESC LIMIT 5
        ) t), '[]') AS top_shows
    FROM users u WHERE u.id = ${userId}`);
  return row;
}
