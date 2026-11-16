/**
 * Import en masse (Letterboxd) : un job persistant et reprenable.
 *
 *  - Les lignes sont d'abord stockées (import_items), puis traitées par lots
 *    de 100 : si le process meurt, un autre reprend là où il en était (bail
 *    `lease_until` renouvelé à chaque lot).
 *  - Correspondance titre|année -> TMDB mise en cache POUR TOUT LE MONDE
 *    (letterboxd_matches) : plus on a d'utilisateurs, moins un import coûte
 *    d'appels TMDB. Un classique comme « Inception 2010 » n'est cherché qu'une fois.
 *  - Chaque lot est appliqué en UNE requête (INSERT … SELECT … GROUP BY),
 *    et les compteurs sont recalculés une fois à la fin.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ImportItemState, ImportStatus, MovieStatus } from "@/db/schema";
import { ensureMovie, pgArray } from "./catalog";
import { findMovie } from "./tmdb";

export type ImportRow = {
  name: string;
  year: number | null;
  watched: boolean;
  watchedAt: string | null; // YYYY-MM-DD
  rating: number | null; // 1..10
  plays: number;
};

const BATCH = 100;
const LEASE_SECONDS = 90;
const TMDB_PARALLEL = 8;

export const matchKey = (name: string, year: number | null) =>
  `${name.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ")}|${year ?? ""}`;

export async function createImport(userId: number, source: string, rows: ImportRow[]) {
  return db.transaction(async (tx) => {
    const [imp] = await tx.execute<{ id: number }>(sql`
      INSERT INTO imports (user_id, source, total) VALUES (${userId}, ${source}, ${rows.length}) RETURNING id`);
    for (let i = 0; i < rows.length; i += 2000) {
      const chunk = rows.slice(i, i + 2000);
      await tx.execute(sql`
        INSERT INTO import_items (import_id, idx, name, year, watched, watched_at, rating, plays)
        SELECT ${imp.id}, * FROM unnest(
          ${pgArray(chunk.map((_, j) => i + j))}::int[],
          ${pgArray(chunk.map((r) => r.name))}::text[],
          ${pgArray(chunk.map((r) => r.year))}::smallint[],
          ${pgArray(chunk.map((r) => (r.watched ? "t" : "f")))}::boolean[],
          ${pgArray(chunk.map((r) => r.watchedAt))}::date[],
          ${pgArray(chunk.map((r) => r.rating))}::smallint[],
          ${pgArray(chunk.map((r) => r.plays))}::smallint[])`);
    }
    return imp.id;
  });
}

/** Prend le bail. Retourne false si un autre worker traite déjà l'import. */
async function takeLease(importId: number) {
  const r = await db.execute(sql`
    UPDATE imports SET lease_until = now() + ${`${LEASE_SECONDS} seconds`}::interval, status = ${ImportStatus.running}
    WHERE id = ${importId} AND status IN (${ImportStatus.pending}, ${ImportStatus.running})
      AND (lease_until IS NULL OR lease_until < now())
    RETURNING id`);
  return r.length > 0;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

export async function processImport(importId: number) {
  if (!(await takeLease(importId))) return;
  const [{ user_id: userId }] = await db.execute<{ user_id: number }>(sql`SELECT user_id FROM imports WHERE id = ${importId}`);
  try {
    for (;;) {
      const batch = await db.execute<{ idx: number; name: string; year: number | null }>(sql`
        SELECT idx, name, year FROM import_items
        WHERE import_id = ${importId} AND state = ${ImportItemState.pending}
        ORDER BY idx LIMIT ${BATCH}`);
      if (!batch.length) break;

      // 1) Correspondances déjà connues (cache partagé), en une requête.
      const keys = [...new Set(batch.map((b) => matchKey(b.name, b.year)))];
      const known = new Map<string, number | null>();
      for (const r of await db.execute<{ key: string; movie_id: number | null }>(sql`
        SELECT key, movie_id FROM letterboxd_matches WHERE key = ANY(${pgArray(keys)}::text[])`)) {
        known.set(r.key, r.movie_id);
      }

      // 2) Les inconnues : recherche TMDB en parallèle borné, puis mise en cache.
      const unknown = batch.filter((b, i, arr) => {
        const k = matchKey(b.name, b.year);
        return !known.has(k) && arr.findIndex((x) => matchKey(x.name, x.year) === k) === i;
      });
      const found: { key: string; id: number | null }[] = [];
      await pool(unknown, TMDB_PARALLEL, async (b) => {
        const key = matchKey(b.name, b.year);
        try {
          const m = await findMovie(b.name, b.year);
          found.push({ key, id: m?.id ?? null });
          known.set(key, m?.id ?? null);
        } catch {
          // Erreur réseau : on ne met pas en cache, l'élément sera marqué introuvable pour cet import.
          known.set(key, null);
        }
      });
      if (found.length) {
        await db.execute(sql`
          INSERT INTO letterboxd_matches (key, movie_id)
          SELECT * FROM unnest(${pgArray(found.map((f) => f.key))}::text[], ${pgArray(found.map((f) => f.id))}::int[])
          ON CONFLICT (key) DO UPDATE SET movie_id = excluded.movie_id, matched_at = now()`);
      }

      // 3) Fiches films manquantes dans le catalogue (runtime nécessaire aux stats).
      const ids = [...new Set([...known.values()].filter((v): v is number => v != null))];
      const missing = ids.length
        ? (await db.execute<{ id: number }>(sql`
            SELECT x AS id FROM unnest(${pgArray(ids)}::int[]) x WHERE NOT EXISTS (SELECT 1 FROM movies WHERE id = x)`)).map((r) => r.id)
        : [];
      const failed = new Set<number>();
      await pool(missing, TMDB_PARALLEL, async (id) => {
        const ok = await ensureMovie(id).catch(() => false);
        if (!ok) failed.add(id);
      });

      // 4) Résultat de chaque ligne du lot.
      const idxs = batch.map((b) => b.idx);
      const movieIds = batch.map((b) => {
        const id = known.get(matchKey(b.name, b.year)) ?? null;
        return id != null && !failed.has(id) ? id : null;
      });
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          UPDATE import_items i SET movie_id = u.movie_id,
            state = CASE WHEN u.movie_id IS NULL THEN ${ImportItemState.notFound}::smallint ELSE ${ImportItemState.matched}::smallint END
          FROM unnest(${pgArray(idxs)}::int[], ${pgArray(movieIds)}::int[]) AS u(idx, movie_id)
          WHERE i.import_id = ${importId} AND i.idx = u.idx`);

        // 5) Application au compte : une requête pour tout le lot.
        //    GROUP BY : le même film peut apparaître plusieurs fois (journal Letterboxd).
        await tx.execute(sql`
          INSERT INTO user_movies AS um (user_id, movie_id, status, plays, rating, watched_at, added_at)
          SELECT ${userId}, i.movie_id,
                 CASE WHEN bool_or(i.watched) THEN ${MovieStatus.watched}::smallint ELSE ${MovieStatus.watchlist}::smallint END,
                 CASE WHEN bool_or(i.watched) THEN greatest(1, max(i.plays)) ELSE 0 END,
                 max(i.rating),
                 CASE WHEN bool_or(i.watched) THEN coalesce(max(i.watched_at)::timestamptz + interval '12 hours', now()) END,
                 now()
          FROM import_items i
          WHERE i.import_id = ${importId} AND i.idx = ANY(${pgArray(idxs)}::int[]) AND i.movie_id IS NOT NULL
          GROUP BY i.movie_id
          ON CONFLICT (user_id, movie_id) DO UPDATE SET
            status = greatest(um.status, excluded.status),
            plays = greatest(um.plays, excluded.plays),
            rating = coalesce(excluded.rating, um.rating),
            watched_at = coalesce(greatest(um.watched_at, excluded.watched_at), um.watched_at, excluded.watched_at)`);

        await tx.execute(sql`
          UPDATE imports SET processed = processed + ${batch.length},
            matched = matched + ${movieIds.filter((m) => m != null).length},
            lease_until = now() + ${`${LEASE_SECONDS} seconds`}::interval
          WHERE id = ${importId}`);
      });
    }

    await db.execute(sql`SELECT recompute_movie_counters(${userId})`);
    await db.execute(sql`
      UPDATE imports SET status = ${ImportStatus.done}, finished_at = now(), lease_until = NULL WHERE id = ${importId}`);
  } catch (e) {
    console.error("import", importId, e);
    // On libère le bail : le prochain GET de progression relancera le traitement.
    await db.execute(sql`UPDATE imports SET lease_until = NULL, error = ${String(e instanceof Error ? e.message : e).slice(0, 500)} WHERE id = ${importId}`);
  }
}

export type ImportProgress = {
  id: number;
  status: number;
  total: number;
  processed: number;
  matched: number;
  stalled: boolean;
  not_found: { name: string; year: number | null }[];
};

export async function getImport(userId: number, importId: number): Promise<ImportProgress | null> {
  const [imp] = await db.execute<Omit<ImportProgress, "not_found">>(sql`
    SELECT id, status, total, processed, matched,
      (status IN (${ImportStatus.pending}, ${ImportStatus.running}) AND (lease_until IS NULL OR lease_until < now())) AS stalled
    FROM imports WHERE id = ${importId} AND user_id = ${userId}`);
  if (!imp) return null;
  const notFound =
    imp.status === ImportStatus.done
      ? await db.execute<{ name: string; year: number | null }>(sql`
          SELECT name, year FROM import_items WHERE import_id = ${importId} AND state = ${ImportItemState.notFound} ORDER BY idx LIMIT 200`)
      : [];
  return { ...imp, not_found: [...notFound] };
}
