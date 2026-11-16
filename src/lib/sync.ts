/**
 * Job quotidien (cron). Coût proportionnel à ce qui a CHANGÉ, pas à la taille
 * du catalogue :
 *  1. /tv/changes et /movie/changes depuis le dernier passage
 *  2. intersection avec NOS titres (on ignore les ~99 % de TMDB que personne ne suit)
 *  3. resynchro de ces titres seulement, en parallèle borné
 *  4. mise à jour de aired_episodes pour les séries ayant eu une diffusion depuis
 *     le dernier passage (une requête ensembliste)
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { pgArray, syncMovie, syncShow } from "./catalog";
import { fetchChanges } from "./tmdb";
import { buildCollabLinks } from "./recs";

const day = (d: Date) => d.toISOString().slice(0, 10);

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const x = items[i++];
        await fn(x).catch((e) => {
          failed++;
          console.error("sync", x, e instanceof Error ? e.message : e);
        });
      }
    }),
  );
  return failed;
}

export async function runDailySync() {
  const [cur] = await db.execute<{ value: string }>(sql`SELECT value FROM sync_state WHERE key = 'changes_since'`);
  const now = new Date();
  // TMDB limite /changes à 14 jours : on borne la fenêtre.
  const since = cur ? new Date(Math.max(Date.parse(cur.value), now.getTime() - 13 * 864e5)) : new Date(now.getTime() - 864e5);
  const start = day(since);
  const end = day(now);

  const [tvChanged, movieChanged] = await Promise.all([fetchChanges("tv", start, end), fetchChanges("movie", start, end)]);

  const ours = async (table: "shows" | "movies", ids: number[]) =>
    ids.length
      ? (await db.execute<{ id: number }>(sql`SELECT id FROM ${sql.identifier(table)} WHERE id = ANY(${pgArray(ids)}::int[])`)).map((r) => r.id)
      : [];
  const [showIds, movieIds] = await Promise.all([ours("shows", tvChanged), ours("movies", movieChanged)]);

  const showFailed = await pool(showIds, 8, syncShow);
  const movieFailed = await pool(movieIds, 8, syncMovie);

  // Épisodes diffusés depuis le dernier passage -> compteur aired_episodes + "à jour" redevient "à voir".
  const aired = await db.execute<{ id: number }>(sql`
    UPDATE shows s SET aired_episodes = aired_episode_count(s.id)
    WHERE s.id IN (SELECT DISTINCT show_id FROM episodes WHERE air_date > ${start}::date - 1 AND air_date <= current_date)
    RETURNING s.id`);

  await db.execute(sql`
    INSERT INTO sync_state (key, value) VALUES ('changes_since', ${now.toISOString()})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
  await db.execute(sql`DELETE FROM sessions WHERE expires_at < now()`);
  // Recalcul du graphe de co-visionnage (recommandations).
  const collab = await buildCollabLinks().catch((e) => ({ error: String(e) }));

  return {
    window: [start, end],
    tmdbChanged: { tv: tvChanged.length, movie: movieChanged.length },
    resynced: { shows: showIds.length - showFailed, movies: movieIds.length - movieFailed },
    failed: { shows: showFailed, movies: movieFailed },
    airedRefreshed: aired.length,
    collab,
  };
}
