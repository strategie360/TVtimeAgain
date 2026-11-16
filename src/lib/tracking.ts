/**
 * Écritures utilisateur. Chaque action = 1 transaction, 2 requêtes maximum,
 * quel que soit le nombre d'épisodes (cocher une saison de 24 épisodes ne fait
 * pas 24 requêtes). Les compteurs dénormalisés sont mis à jour dans la même
 * transaction : ils ne peuvent pas diverger.
 */
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { MovieStatus, ShowStatus } from "@/db/schema";
import { pgArray } from "./catalog";

export type EpisodeSelector =
  | { episodeIds: number[] }
  | { season: number }
  | { upToEpisodeId: number } // "j'ai tout vu jusqu'ici"
  | { all: true };

function selectorFilter(sel: EpisodeSelector): SQL {
  if ("episodeIds" in sel) return sql`e.id = ANY(${pgArray(sel.episodeIds)}::int[])`;
  if ("season" in sel) return sql`e.season = ${sel.season}`;
  if ("upToEpisodeId" in sel)
    return sql`e.season > 0 AND (e.season, e.number) <= (SELECT season, number FROM episodes WHERE id = ${sel.upToEpisodeId} AND show_id = e.show_id)`;
  return sql`e.season > 0`;
}

/** Statut après une écriture : terminée si à jour ET série finie. */
const STATUS_AFTER = sql`CASE
  WHEN us.next_episode_id IS NULL AND s.status IN ('Ended', 'Canceled') THEN ${ShowStatus.completed}::smallint
  ELSE ${ShowStatus.watching}::smallint END`;

export async function markEpisodes(userId: number, showId: number, sel: EpisodeSelector) {
  return db.transaction(async (tx) => {
    // 1) Insertion en masse + compteurs, en une seule requête (CTE).
    //    Seuls les épisodes déjà diffusés peuvent être cochés.
    const [agg] = await tx.execute<{ n: number; m: number }>(sql`
      WITH ins AS (
        INSERT INTO watched_episodes (user_id, show_id, episode_id)
        SELECT ${userId}, e.show_id, e.id FROM episodes e
        WHERE e.show_id = ${showId} AND e.air_date <= current_date AND ${selectorFilter(sel)}
        ON CONFLICT DO NOTHING
        RETURNING episode_id
      ), agg AS (
        SELECT count(*)::int AS n,
               coalesce(sum(coalesce(e.runtime, s.episode_runtime, 0)), 0)::int AS m
        FROM ins JOIN episodes e ON e.id = ins.episode_id JOIN shows s ON s.id = e.show_id
      ), up AS (
        INSERT INTO user_shows AS us (user_id, show_id, watched_count, last_watched_at)
        SELECT ${userId}, ${showId}, n, now() FROM agg
        ON CONFLICT (user_id, show_id) DO UPDATE
          SET watched_count = us.watched_count + excluded.watched_count, last_watched_at = now()
      ), u AS (
        UPDATE users SET episodes_watched = episodes_watched + agg.n,
                         episode_minutes = episode_minutes + agg.m
        FROM agg WHERE users.id = ${userId} AND agg.n > 0
      )
      SELECT n, m FROM agg`);

    // 2) Prochain épisode + statut (doit voir les lignes insérées => requête séparée).
    const [row] = await tx.execute<{ next_episode_id: number | null; status: number; watched_count: number }>(sql`
      UPDATE user_shows us SET next_episode_id = next_episode_id(us.user_id, us.show_id)
      FROM shows s WHERE s.id = us.show_id AND us.user_id = ${userId} AND us.show_id = ${showId}
      RETURNING us.next_episode_id, us.watched_count, us.status`);
    await tx.execute(sql`
      UPDATE user_shows us SET status = ${STATUS_AFTER}
      FROM shows s WHERE s.id = us.show_id AND us.user_id = ${userId} AND us.show_id = ${showId}`);
    return { added: agg?.n ?? 0, minutes: agg?.m ?? 0, nextEpisodeId: row?.next_episode_id ?? null };
  });
}

export async function unmarkEpisodes(userId: number, showId: number, sel: EpisodeSelector) {
  return db.transaction(async (tx) => {
    const [agg] = await tx.execute<{ n: number; m: number }>(sql`
      WITH del AS (
        DELETE FROM watched_episodes w USING episodes e
        WHERE w.user_id = ${userId} AND w.show_id = ${showId} AND e.id = w.episode_id AND ${selectorFilter(sel)}
        RETURNING w.episode_id, w.plays
      ), agg AS (
        SELECT count(*)::int AS n,
               coalesce(sum(del.plays * coalesce(e.runtime, s.episode_runtime, 0)), 0)::int AS m,
               coalesce(sum(del.plays), 0)::int AS p
        FROM del JOIN episodes e ON e.id = del.episode_id JOIN shows s ON s.id = e.show_id
      ), up AS (
        UPDATE user_shows SET watched_count = greatest(0, watched_count - agg.n)
        FROM agg WHERE user_id = ${userId} AND show_id = ${showId}
      ), u AS (
        UPDATE users SET episodes_watched = greatest(0, episodes_watched - agg.p),
                         episode_minutes = greatest(0, episode_minutes - agg.m)
        FROM agg WHERE users.id = ${userId} AND agg.n > 0
      )
      SELECT n, m FROM agg`);
    await tx.execute(sql`
      UPDATE user_shows us SET next_episode_id = next_episode_id(us.user_id, us.show_id)
      WHERE us.user_id = ${userId} AND us.show_id = ${showId}`);
    await tx.execute(sql`
      UPDATE user_shows us SET status = ${STATUS_AFTER}
      FROM shows s WHERE s.id = us.show_id AND us.user_id = ${userId} AND us.show_id = ${showId}
        AND us.status <> ${ShowStatus.stopped}`);
    return { removed: agg?.n ?? 0 };
  });
}

/** Suivre une série sans rien cocher (statut "à voir" par défaut). */
export async function followShow(userId: number, showId: number, status: number = ShowStatus.planned) {
  await db.execute(sql`
    INSERT INTO user_shows (user_id, show_id, status, next_episode_id)
    VALUES (${userId}, ${showId}, ${status}, next_episode_id(${userId}, ${showId}))
    ON CONFLICT (user_id, show_id) DO UPDATE SET status = excluded.status`);
}

/**
 * Ne plus suivre : on retire la série et son historique.
 * Les compteurs globaux sont décrémentés en conséquence (même transaction).
 */
export async function unfollowShow(userId: number, showId: number) {
  await unmarkEpisodes(userId, showId, { all: true });
  // Les épisodes "spéciaux" (saison 0) ne sont pas couverts par {all} :
  await unmarkEpisodes(userId, showId, { season: 0 });
  await db.execute(sql`DELETE FROM user_shows WHERE user_id = ${userId} AND show_id = ${showId}`);
}

export async function setShowFlags(
  userId: number,
  showId: number,
  flags: { status?: number; favorite?: boolean; rating?: number | null },
) {
  await db.execute(sql`
    UPDATE user_shows SET
      status = coalesce(${flags.status ?? null}::smallint, status),
      favorite = coalesce(${flags.favorite ?? null}::boolean, favorite),
      rating = CASE WHEN ${flags.rating !== undefined} THEN ${flags.rating ?? null}::smallint ELSE rating END
    WHERE user_id = ${userId} AND show_id = ${showId}`);
}

// ─────────────────────────── Films ───────────────────────────

export async function markMovieWatched(userId: number, movieId: number) {
  // Revisionnage = plays + 1 ; un film ne compte qu'une fois dans movies_watched,
  // mais chaque visionnage s'ajoute au temps total.
  await db.execute(sql`
    WITH prev AS (
      SELECT status FROM user_movies WHERE user_id = ${userId} AND movie_id = ${movieId}
    ), up AS (
      INSERT INTO user_movies AS um (user_id, movie_id, status, plays, watched_at)
      VALUES (${userId}, ${movieId}, ${MovieStatus.watched}, 1, now())
      ON CONFLICT (user_id, movie_id) DO UPDATE
        SET status = ${MovieStatus.watched}, plays = um.plays + 1, watched_at = now()
    )
    UPDATE users SET
      movies_watched = movies_watched + CASE WHEN coalesce((SELECT status FROM prev), -1) = ${MovieStatus.watched} THEN 0 ELSE 1 END,
      movie_minutes = movie_minutes + coalesce((SELECT runtime FROM movies WHERE id = ${movieId}), 0)
    WHERE id = ${userId}`);
}

export async function unmarkMovie(userId: number, movieId: number) {
  await db.execute(sql`
    WITH del AS (
      DELETE FROM user_movies WHERE user_id = ${userId} AND movie_id = ${movieId} RETURNING status, plays
    )
    UPDATE users SET
      movies_watched = greatest(0, movies_watched - (SELECT count(*) FROM del WHERE status = ${MovieStatus.watched})),
      movie_minutes = greatest(0, movie_minutes - coalesce((SELECT plays FROM del), 0) * coalesce((SELECT runtime FROM movies WHERE id = ${movieId}), 0))
    WHERE id = ${userId} AND EXISTS (SELECT 1 FROM del)`);
}

export async function addMovieToWatchlist(userId: number, movieId: number) {
  await db.execute(sql`
    INSERT INTO user_movies (user_id, movie_id, status) VALUES (${userId}, ${movieId}, ${MovieStatus.watchlist})
    ON CONFLICT DO NOTHING`);
}

/** Note d'un film (1..10, null = effacer). Noter un film le met dans « vus » si besoin. */
export async function setMovieRating(userId: number, movieId: number, rating: number | null) {
  await db.execute(sql`
    INSERT INTO user_movies AS um (user_id, movie_id, status, plays, rating)
    VALUES (${userId}, ${movieId}, ${MovieStatus.watched}, 1, ${rating}::smallint)
    ON CONFLICT (user_id, movie_id) DO UPDATE SET rating = excluded.rating,
      status = ${MovieStatus.watched}, plays = greatest(um.plays, 1)`);
  await db.execute(sql`SELECT recompute_movie_counters(${userId})`);
}

/**
 * « Déjà vus » en lot (sélection rapide) : une seule requête pour N films.
 * Pas de date de visionnage (inconnue) : watched_at reste NULL.
 */
export async function markMoviesWatchedBatch(userId: number, movieIds: number[]) {
  if (!movieIds.length) return 0;
  const [r] = await db.execute<{ n: number }>(sql`
    WITH ins AS (
      INSERT INTO user_movies AS um (user_id, movie_id, status, plays)
      SELECT ${userId}, m.id, ${MovieStatus.watched}, 1 FROM movies m WHERE m.id = ANY(${pgArray(movieIds)}::int[])
      ON CONFLICT (user_id, movie_id) DO UPDATE SET status = ${MovieStatus.watched}, plays = greatest(um.plays, 1)
      RETURNING 1)
    SELECT count(*)::int AS n FROM ins`);
  await db.execute(sql`SELECT recompute_movie_counters(${userId})`);
  return r.n;
}
