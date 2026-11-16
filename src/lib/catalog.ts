/**
 * Catalogue partagé : synchronisation TMDB -> Postgres.
 *
 *  - ensureShow / ensureMovie : chargement à la demande (première fois qu'un
 *    utilisateur ajoute un titre). Les appels simultanés pour le même titre sont
 *    dédupliqués (Map en mémoire + verrou consultatif Postgres entre process).
 *  - Données périmées : servies immédiatement, rafraîchies en arrière-plan.
 *  - Upserts en lot (1 requête pour tous les épisodes d'une série).
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fetchMovie, fetchShowWithEpisodes, type TmdbEpisode } from "./tmdb";

const STALE_MS = 7 * 24 * 3600 * 1000; // filet de sécurité ; le job /changes fait le gros du travail
const LOCK_SHOW = 1;
const LOCK_MOVIE = 2;

const inflight = new Map<string, Promise<void>>();
function dedupe(key: string, fn: () => Promise<void>) {
  let p = inflight.get(key);
  if (!p) {
    p = fn().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

const toDate = (s: string | null | undefined) => (s && s.length >= 10 ? s : null);
const clampSmall = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? null : Math.max(0, Math.min(32767, Math.round(n)));

/** Garantit que la série existe en base. Retourne false si TMDB ne la connaît pas. */
export async function ensureShow(id: number, opts: { background?: (p: Promise<unknown>) => void } = {}) {
  const [row] = await db.execute<{ synced_at: Date }>(sql`SELECT synced_at FROM shows WHERE id = ${id}`);
  if (row) {
    if (Date.now() - new Date(row.synced_at).getTime() > STALE_MS) {
      const p = dedupe(`show:${id}`, () => syncShow(id)).catch(() => {});
      opts.background?.(p);
    }
    return true;
  }
  try {
    await dedupe(`show:${id}`, () => syncShow(id));
    return true;
  } catch (e) {
    if ((e as { status?: number }).status === 404) return false;
    throw e;
  }
}

export async function syncShow(id: number) {
  const { show, episodes } = await fetchShowWithEpisodes(id);
  const runtime = clampSmall(show.episode_run_time?.[0]);

  await db.transaction(async (tx) => {
    // Un seul process synchronise une série donnée à la fois.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_SHOW}, ${id})`);

    await tx.execute(sql`
      INSERT INTO shows (id, name, overview, poster_path, backdrop_path, first_air_date, status,
                         network, genre_ids, episode_runtime, season_count, popularity, vote_average, vote_count, synced_at)
      VALUES (${show.id}, ${show.name}, ${show.overview || null}, ${show.poster_path}, ${show.backdrop_path},
              ${toDate(show.first_air_date)}, ${show.status}, ${show.networks?.[0]?.name ?? null},
              ${pgArray((show.genres ?? []).map((g) => g.id))}::smallint[],
              ${runtime}, ${show.number_of_seasons ?? 0}, ${show.popularity ?? 0},
              ${show.vote_average ?? null}::real, ${show.vote_count ?? null}::int, now())
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name, overview = excluded.overview, poster_path = excluded.poster_path,
        backdrop_path = excluded.backdrop_path, first_air_date = excluded.first_air_date,
        status = excluded.status, network = excluded.network, genre_ids = excluded.genre_ids,
        episode_runtime = excluded.episode_runtime, season_count = excluded.season_count,
        popularity = excluded.popularity, vote_average = excluded.vote_average,
        vote_count = excluded.vote_count, synced_at = now()`);

    await upsertEpisodes(tx, id, episodes);

    // Épisodes disparus chez TMDB (renumérotation, doublons supprimés…).
    const ids = episodes.map((e) => e.id);
    const removed = await tx.execute(sql`
      DELETE FROM episodes WHERE show_id = ${id}
      AND NOT (id = ANY(${pgArray(ids)}::int[])) RETURNING id`);

    await tx.execute(sql`UPDATE shows SET aired_episodes = aired_episode_count(id) WHERE id = ${id}`);

    // Recalcul ciblé du "prochain épisode" : seulement les spectateurs à jour
    // (nouvelle saison annoncée) ou pointant sur un épisode supprimé.
    // Une seule requête ensembliste, quel que soit le nombre de spectateurs.
    await tx.execute(sql`
      UPDATE user_shows us SET next_episode_id = next_episode_id(us.user_id, us.show_id)
      WHERE us.show_id = ${id}
        AND (us.next_episode_id IS NULL ${removed.length ? sql`OR us.next_episode_id = ANY(${pgArray(removed.map((r) => r.id as number))}::int[])` : sql``})`);
  });
}

async function upsertEpisodes(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], showId: number, eps: TmdbEpisode[]) {
  // Dédoublonnage défensif : TMDB renvoie parfois deux fois le même id.
  const seen = new Set<number>();
  const rows = eps.filter((e) => !seen.has(e.id) && seen.add(e.id));
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    // unnest() sur des tableaux : 9 paramètres au lieu de 9×N, plan stable.
    await tx.execute(sql`
      INSERT INTO episodes (id, show_id, season, number, name, overview, air_date, runtime, still_path)
      SELECT * FROM unnest(
        ${pgArray(chunk.map((e) => e.id))}::int[],
        ${pgArray(chunk.map(() => showId))}::int[],
        ${pgArray(chunk.map((e) => e.season_number))}::smallint[],
        ${pgArray(chunk.map((e) => e.episode_number))}::smallint[],
        ${pgArray(chunk.map((e) => e.name || null))}::text[],
        ${pgArray(chunk.map((e) => e.overview || null))}::text[],
        ${pgArray(chunk.map((e) => toDate(e.air_date)))}::date[],
        ${pgArray(chunk.map((e) => clampSmall(e.runtime)))}::smallint[],
        ${pgArray(chunk.map((e) => e.still_path))}::text[])
      ON CONFLICT (id) DO UPDATE SET
        show_id = excluded.show_id, season = excluded.season, number = excluded.number,
        name = excluded.name, overview = excluded.overview, air_date = excluded.air_date,
        runtime = excluded.runtime, still_path = excluded.still_path
      WHERE (episodes.season, episodes.number, episodes.name, episodes.overview, episodes.air_date,
             episodes.runtime, episodes.still_path)
        IS DISTINCT FROM (excluded.season, excluded.number, excluded.name, excluded.overview,
             excluded.air_date, excluded.runtime, excluded.still_path)`);
    // ^ le WHERE évite de réécrire (et de faire grossir la table) quand rien n'a changé.
  }
}

/**
 * Littéral de tableau Postgres sérialisé côté app : un seul paramètre lié,
 * quel que soit le nombre d'éléments.
 */
function pgArray(values: (string | number | null)[]) {
  return (
    "{" +
    values
      .map((v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`))
      .join(",") +
    "}"
  );
}

export async function ensureMovie(id: number, opts: { background?: (p: Promise<unknown>) => void } = {}) {
  const [row] = await db.execute<{ synced_at: Date }>(sql`SELECT synced_at FROM movies WHERE id = ${id}`);
  if (row) {
    if (Date.now() - new Date(row.synced_at).getTime() > STALE_MS) {
      const p = dedupe(`movie:${id}`, () => syncMovie(id)).catch(() => {});
      opts.background?.(p);
    }
    return true;
  }
  try {
    await dedupe(`movie:${id}`, () => syncMovie(id));
    return true;
  } catch (e) {
    if ((e as { status?: number }).status === 404) return false;
    throw e;
  }
}

export async function syncMovie(id: number) {
  const m = await fetchMovie(id);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_MOVIE}, ${id})`);
    await tx.execute(sql`
      INSERT INTO movies (id, title, overview, poster_path, backdrop_path, release_date, runtime, genre_ids, popularity,
                          vote_average, vote_count, synced_at)
      VALUES (${m.id}, ${m.title}, ${m.overview || null}, ${m.poster_path}, ${m.backdrop_path},
              ${toDate(m.release_date)}, ${clampSmall(m.runtime)},
              ${pgArray((m.genres ?? []).map((g) => g.id))}::smallint[], ${m.popularity ?? 0},
              ${m.vote_average ?? null}::real, ${m.vote_count ?? null}::int, now())
      ON CONFLICT (id) DO UPDATE SET
        title = excluded.title, overview = excluded.overview, poster_path = excluded.poster_path,
        backdrop_path = excluded.backdrop_path, release_date = excluded.release_date,
        runtime = excluded.runtime, genre_ids = excluded.genre_ids, popularity = excluded.popularity,
        vote_average = excluded.vote_average, vote_count = excluded.vote_count,
        synced_at = now()`);
  });
}

export { pgArray };
