import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";

const TABLES = [
  "import_items", "imports", "letterboxd_matches", "user_feedback", "link_fetches", "item_links",
  "media_features", "people", "director_credits",
  "media_summary", "watched_episodes", "user_shows", "user_movies", "sessions", "users",
  "episodes", "shows", "movies", "sync_state",
];

/** Vide toutes les tables du projet (pas la table de migrations). */
export async function resetDb() {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`));
}

export async function createUser(name = "alice") {
  const [u] = await db.execute<{ id: number }>(sql`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${`${name}@example.test`}, 'x', ${name}) RETURNING id`);
  return u.id;
}

/** Date YYYY-MM-DD décalée de `offset` jours par rapport à aujourd'hui. */
export const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

export const epId = (showId: number, season: number, number: number) => showId * 1000 + season * 100 + number;

type EpisodeSpec = { season: number; number: number; airOffsetDays: number | null; runtime?: number | null };

/** Insère une série et ses épisodes (id d'épisode : voir epId). */
export async function createShow(opts: {
  id: number;
  name?: string;
  status?: string;
  runtime?: number;
  genreIds?: number[];
  episodes: EpisodeSpec[];
}) {
  await db.execute(sql`
    INSERT INTO shows (id, name, status, episode_runtime, genre_ids, season_count)
    VALUES (${opts.id}, ${opts.name ?? `Show ${opts.id}`}, ${opts.status ?? "Returning Series"},
            ${opts.runtime ?? 40}, ${`{${(opts.genreIds ?? []).join(",")}}`}::smallint[],
            ${new Set(opts.episodes.map((e) => e.season)).size})`);
  for (const e of opts.episodes) {
    await db.execute(sql`
      INSERT INTO episodes (id, show_id, season, number, air_date, runtime)
      VALUES (${epId(opts.id, e.season, e.number)}, ${opts.id}, ${e.season}, ${e.number},
              ${e.airOffsetDays == null ? null : day(e.airOffsetDays)}::date, ${e.runtime ?? null})`);
  }
  await db.execute(sql`UPDATE shows SET aired_episodes = aired_episode_count(id) WHERE id = ${opts.id}`);
}

/** `seasons` saisons de `perSeason` épisodes, toutes déjà diffusées (une semaine d'écart). */
export function airedSeasons(seasons: number, perSeason: number): EpisodeSpec[] {
  const out: EpisodeSpec[] = [];
  let offset = -7 * seasons * perSeason - 7;
  for (let s = 1; s <= seasons; s++)
    for (let n = 1; n <= perSeason; n++) out.push({ season: s, number: n, airOffsetDays: (offset += 7) });
  return out;
}

export async function createMovie(id: number, opts: { title?: string; runtime?: number | null; genreIds?: number[] } = {}) {
  await db.execute(sql`
    INSERT INTO movies (id, title, runtime, genre_ids)
    VALUES (${id}, ${opts.title ?? `Movie ${id}`}, ${opts.runtime === undefined ? 100 : opts.runtime},
            ${`{${(opts.genreIds ?? []).join(",")}}`}::smallint[])`);
}

export async function one<T>(query: SQL): Promise<T> {
  const [row] = await db.execute<Record<string, unknown>>(query);
  return row as T;
}
