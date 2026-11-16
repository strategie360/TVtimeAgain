/**
 * Moteur de recommandation hybride (films + séries).
 *
 *   score(c) = CF(c) × qualité(c) × affinité_genres(c) × notoriété(c)², puis re-classement pour la diversité
 *
 * 1. GRAINES : tout ce que l'utilisateur a vu, noté, mis en liste, avec un poids
 *    w ∈ [-1, 1] : note centrée (10/10 → +1, 1/10 → -1), engagement pour les
 *    séries (part des épisodes vus, favori, abandon = négatif), décroissance
 *    temporelle (un film vu il y a 5 ans pèse moitié moins qu'hier).
 *
 * 2. CANDIDATS par filtrage collaboratif item-item, via le graphe partagé item_links :
 *      - liens TMDB (« les gens qui ont aimé X ont aimé Y » chez TMDB)
 *      - liens calculés sur NOS utilisateurs (cosinus de co-visionnage), pondérés 1,5×
 *    CF(c) = Σ_graines w(s) × lien(s, c). Une graine mal notée POUSSE VERS LE BAS
 *    les titres qui lui ressemblent.
 *
 * 3. QUALITÉ : moyenne bayésienne de la note TMDB (un 9/10 sur 12 votes ne bat
 *    pas un 8,4/10 sur 30 000 votes).
 *
 * 4. AFFINITÉ DE GENRES : profil de genres de l'utilisateur, pondéré par ses notes.
 *
 * 4 bis. NOTORIÉTÉ : à quel point les titres qu'il aime sont connus (nombre de votes TMDB). Un candidat
 *    nettement plus confidentiel que d'habitude est pénalisé, jamais un plus connu. C'est le signal le
 *    plus discriminant mesuré sur un vrai historique (voir notorietyProfile).
 *
 * 5. DIVERSITÉ : re-classement glouton qui pénalise les titres venant de la même
 *    graine ou du même genre principal, pour éviter « 10 films Marvel d'affilée ».
 *
 * Chaque recommandation est EXPLIQUÉE (« Parce que tu as aimé X »).
 *
 * Réglages (DEFAULT_TUNING) choisis par mesure hors ligne : `npm run recs:holdout -- <export Letterboxd>`.
 *
 * Coût : tout est lu en local (graphe pré-calculé), 2 requêtes SQL par appel.
 * TMDB n'est appelé que pour les graines jamais vues par AUCUN utilisateur.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Kind, LinkSource } from "@/db/schema";
import { pgArray } from "./catalog";
import { discoverByGenres, fetchList, fetchRecommendations, type TmdbListItem } from "./tmdb";

const LINK_TTL_DAYS = 30;
/**
 * Réglages de l'algorithme. Les valeurs par défaut sont celles mesurées comme les meilleures
 * (npm run recs:holdout) ; on peut les surcharger pour une expérience.
 */
export type Tuning = {
  maxSeeds: number; // graines (titres de l'utilisateur) utilisées pour trouver les candidats
  popularityFit: number; // poids du profil de notoriété (0 = ignoré) : favorise les titres aussi connus que ceux qu'il aime
  cfExponent: number; // poids de la proximité avec ses titres (exposant du score collaboratif)
  candidatePool: number; // candidats évalués, pris parmi les mieux reliés à ses titres
  diversitySeed: number; // facteur appliqué à chaque nouveau titre issu de la même graine (1 = aucun effet)
  diversityGenre: number; // idem pour le même genre principal
};
// Mesuré le 2026-11-16 sur un vrai historique (1 044 titres, 92 films cachés, 3 tirages) :
// rappel@50 de 0,109 (40 graines, sans profil de notoriété) à 0,156.
export const DEFAULT_TUNING: Tuning = {
  maxSeeds: 300,
  popularityFit: 2,
  cfExponent: 1,
  candidatePool: 600,
  diversitySeed: 0.8,
  diversityGenre: 0.92,
};
const SYNC_FETCH = 8; // graines dont on va chercher les liens tout de suite (le reste en arrière-plan)
const BAYES_M = 300; // nombre de votes « virtuels »
const BAYES_C = 6.8; // note moyenne a priori

export type KindName = "movie" | "show";
const kindNum = (k: KindName) => (k === "movie" ? Kind.movie : Kind.show);

export type Recommendation = {
  kind: KindName;
  id: number;
  title: string;
  poster_path: string | null;
  year: number | null;
  score: number;
  reason: string;
};

type Seed = { kind: number; id: number; w: number; genre_ids: number[]; name: string; linked: boolean; vote_count: number | null };

// ─────────────────────────── Graphe TMDB ───────────────────────────

const toSummary = (kind: number, r: TmdbListItem) => ({
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

const inflight = new Map<string, Promise<void>>();

/** Récupère (une fois pour tout le monde) les recommandations TMDB d'un titre. */
export function ensureLinks(kind: number, id: number) {
  const key = `${kind}:${id}`;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      // 404 = TMDB ne connaît pas de recommandations pour ce titre : on le note quand même,
      // sinon on redemanderait à chaque affichage (bug constaté : p95 à 1,8 s).
      const results = await fetchRecommendations(kind === Kind.movie ? "movie" : "tv", id).catch((e) => {
        if ((e as { status?: number }).status === 404) return [] as TmdbListItem[];
        throw e;
      });
      const items = results
        .map((r) => ({ r, k: r.media_type === "tv" ? Kind.show : r.media_type === "movie" ? Kind.movie : kind }))
        .filter((x) => x.r.id !== id || x.k !== kind);
      await upsertSummaries(items.map((x) => toSummary(x.k, x.r)));
      await db.transaction(async (tx) => {
        await tx.execute(sql`DELETE FROM item_links WHERE src_kind = ${kind} AND src_id = ${id} AND source = ${LinkSource.tmdb}`);
        if (items.length) {
          // Score selon le rang : 1er = 1, 10e ≈ 0,29, 20e ≈ 0,23.
          await tx.execute(sql`
            INSERT INTO item_links (src_kind, src_id, source, dst_kind, dst_id, score)
            SELECT ${kind}, ${id}, ${LinkSource.tmdb}, k, i, 1.0 / log(2, r + 2)
            FROM unnest(${pgArray(items.map((x) => x.k))}::smallint[], ${pgArray(items.map((x) => x.r.id))}::int[])
                 WITH ORDINALITY AS u(k, i, r)
            ON CONFLICT DO NOTHING`);
        }
        await tx.execute(sql`
          INSERT INTO link_fetches (kind, id, fetched_at) VALUES (${kind}, ${id}, now())
          ON CONFLICT (kind, id) DO UPDATE SET fetched_at = now()`);
      });
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

// ─────────────────────────── Genres ───────────────────────────

/** TMDB n'a pas les mêmes ids de genres pour les films et les séries. */
const MOVIE_TO_TV: Record<number, number> = { 28: 10759, 12: 10759, 878: 10765, 14: 10765, 10752: 10768, 53: 9648, 27: 9648 };
const TV_TO_MOVIE: Record<number, number> = { 10759: 28, 10765: 878, 10768: 10752 };
export const GENRE_NAMES: Record<number, string> = {
  28: "action", 12: "aventure", 16: "animation", 35: "comédie", 80: "policier", 99: "documentaire", 18: "drame",
  10751: "familial", 14: "fantastique", 36: "histoire", 27: "horreur", 10402: "musique", 9648: "mystère",
  10749: "romance", 878: "science-fiction", 53: "thriller", 10752: "guerre", 37: "western",
  10759: "action & aventure", 10765: "SF & fantastique", 10768: "guerre & politique", 10764: "téléréalité", 10767: "talk-show",
};
/** Ramène un genre dans l'espace d'ids du type demandé. */
const toKindGenre = (g: number, kind: number) => (kind === Kind.show ? MOVIE_TO_TV[g] ?? g : TV_TO_MOVIE[g] ?? g);

// ─────────────────────────── Graines ───────────────────────────

async function loadSeeds(userId: number): Promise<Seed[]> {
  // Notes centrées sur 5,5/10. (Centrer sur la moyenne de l'utilisateur a été mesuré : moins bon.)
  // Décroissance : facteur 0,5 + 0,5·e^(-âge/1 an).
  const rows = await db.execute<Seed>(sql`
    WITH c AS (SELECT 5.5::real AS center), s AS (
      SELECT ${Kind.movie}::int AS kind, um.movie_id AS id, m.genre_ids, m.title AS name, m.vote_count,
        (CASE WHEN um.status = 0 THEN 0.25
              WHEN um.rating IS NULL THEN 0.6
              ELSE greatest(-1, least(1, (um.rating - (SELECT center FROM c)) / 4.5)) END)
        * (0.5 + 0.5 * exp(-extract(epoch FROM now() - coalesce(um.watched_at, um.added_at)) / 31536000.0)) AS w
      FROM user_movies um JOIN movies m ON m.id = um.movie_id
      WHERE um.user_id = ${userId}
      UNION ALL
      SELECT ${Kind.show}, us.show_id, s.genre_ids, s.name, s.vote_count,
        (CASE WHEN us.rating IS NOT NULL THEN greatest(-1, least(1, (us.rating - (SELECT center FROM c)) / 4.5))
              WHEN us.status = 3 THEN -0.5
              WHEN us.watched_count = 0 THEN 0.25
              ELSE 0.3 + 0.7 * least(1, us.watched_count::real / greatest(1, least(s.aired_episodes, 20))) END)
        * (CASE WHEN us.favorite THEN 1.3 ELSE 1 END)
        * (0.5 + 0.5 * exp(-extract(epoch FROM now() - coalesce(us.last_watched_at, us.added_at)) / 31536000.0))
      FROM user_shows us JOIN shows s ON s.id = us.show_id
      WHERE us.user_id = ${userId}
    )
    SELECT s.kind, s.id, s.genre_ids, s.name, s.vote_count, s.w::real AS w,
           (lf.fetched_at IS NOT NULL AND lf.fetched_at > now() - ${`${LINK_TTL_DAYS} days`}::interval) AS linked
    FROM s LEFT JOIN link_fetches lf ON lf.kind = s.kind AND lf.id = s.id`);
  return [...rows];
}

/** Profil de genres ∈ [-1, 1] : somme des poids des titres contenant chaque genre. */
function genreProfile(seeds: Seed[]) {
  const acc = new Map<number, number>();
  for (const s of seeds)
    for (const g of s.genre_ids ?? []) {
      // Un genre compte dans les deux espaces (films et séries) pour que le goût voyage.
      for (const k of new Set([g, toKindGenre(g, Kind.movie), toKindGenre(g, Kind.show)])) acc.set(k, (acc.get(k) ?? 0) + s.w);
    }
  const max = Math.max(1e-6, ...[...acc.values()].map(Math.abs));
  return new Map([...acc].map(([g, v]) => [g, v / max]));
}

/**
 * Profil de notoriété : à quel point les titres qu'il aime sont connus (moyenne et dispersion du
 * log10 du nombre de votes TMDB, pondérées par son appréciation). Mesuré sur un vrai historique, c'est
 * le signal qui distingue le mieux ce qu'un utilisateur aimera parmi les candidats (AUC 0,97).
 * Personnel : un amateur de films confidentiels obtient l'effet inverse d'un amateur de classiques.
 */
export function notorietyProfile(seeds: { w: number; vote_count: number | null }[]) {
  const liked = seeds.filter((s) => s.w > 0 && s.vote_count != null);
  const total = liked.reduce((a, s) => a + s.w, 0);
  if (liked.length < 5 || total <= 0) return null; // trop peu d'historique pour en tirer un profil
  const logs = liked.map((s) => ({ l: Math.log10(s.vote_count! + 1), w: s.w }));
  const mean = logs.reduce((a, x) => a + x.w * x.l, 0) / total;
  const variance = logs.reduce((a, x) => a + x.w * (x.l - mean) ** 2, 0) / total;
  return { mean, sigma: Math.max(0.35, Math.sqrt(variance)) };
}

/**
 * Ressemblance (0..1] entre la notoriété d'un candidat et le profil de l'utilisateur. À sens unique :
 * un titre plus connu que d'habitude n'est jamais pénalisé, seul un titre nettement plus confidentiel
 * l'est (on aime rarement ce qui est bien plus obscur que ce qu'on regarde).
 */
export function notorietyFit(voteCount: number, profile: { mean: number; sigma: number } | null) {
  if (!profile) return 1;
  const z = (Math.log10(voteCount + 1) - profile.mean) / profile.sigma;
  return z >= 0 ? 1 : Math.exp(-0.5 * z * z);
}

// ─────────────────────────── Recommandation ───────────────────────────

type Candidate = {
  kind: number;
  id: number;
  title: string;
  poster_path: string | null;
  year: number | null;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  cf: number;
  top_seed_kind: number;
  top_seed_id: number;
  support: number;
};

export async function recommend(
  userId: number,
  opts: { kind?: KindName; limit?: number; background?: (p: Promise<unknown>) => void; tuning?: Partial<Tuning> } = {},
): Promise<Recommendation[]> {
  const limit = Math.min(opts.limit ?? 30, 100);
  const tuning = { ...DEFAULT_TUNING, ...opts.tuning };
  const seeds = await loadSeeds(userId);

  // Graines « fortes » d'abord (positives) ; on garde quelques négatives pour repousser.
  const ranked = [...seeds].sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, tuning.maxSeeds);

  // Liens manquants : les plus importantes tout de suite, le reste en arrière-plan.
  // Les titres détestés aussi : leurs voisins seront repoussés.
  const missing = ranked.filter((s) => !s.linked && (s.w > 0 || s.w < -0.3));
  const now = missing.slice(0, SYNC_FETCH);
  await Promise.all(now.map((s) => ensureLinks(s.kind, s.id).catch(() => {})));
  const later = missing.slice(SYNC_FETCH);
  if (later.length) {
    const p = (async () => {
      for (const s of later) await ensureLinks(s.kind, s.id).catch(() => {});
    })();
    opts.background?.(p);
  }

  const profile = genreProfile(seeds);
  const notoriety = notorietyProfile(seeds);
  const wanted = opts.kind ? [kindNum(opts.kind)] : [Kind.movie, Kind.show];

  let candidates: Candidate[] = [];
  if (ranked.length) {
    candidates = [
      ...(await db.execute<Candidate>(sql`
        WITH seeds AS (
          SELECT * FROM unnest(${pgArray(ranked.map((s) => s.kind))}::smallint[],
                               ${pgArray(ranked.map((s) => s.id))}::int[],
                               ${pgArray(ranked.map((s) => s.w))}::real[]) AS t(kind, id, w)
        ), agg AS (
          SELECT l.dst_kind AS kind, l.dst_id AS id,
                 sum(sd.w * l.score * CASE WHEN l.source = ${LinkSource.collab} THEN 1.5 ELSE 1 END) AS cf,
                 count(*) FILTER (WHERE sd.w > 0) AS support,
                 (array_agg(sd.kind ORDER BY sd.w * l.score DESC))[1] AS top_seed_kind,
                 (array_agg(sd.id ORDER BY sd.w * l.score DESC))[1] AS top_seed_id
          FROM seeds sd
          JOIN item_links l ON l.src_kind = sd.kind AND l.src_id = sd.id
          WHERE l.dst_kind = ANY(${pgArray(wanted)}::smallint[])
          GROUP BY 1, 2
          HAVING sum(sd.w * l.score) > 0
        )
        SELECT a.kind, a.id, ms.title, ms.poster_path, ms.year, ms.genre_ids, ms.vote_average, ms.vote_count,
               a.cf::real AS cf, a.support::int AS support, a.top_seed_kind, a.top_seed_id
        FROM agg a
        JOIN media_summary ms ON ms.kind = a.kind AND ms.id = a.id
        WHERE NOT EXISTS (SELECT 1 FROM user_movies um WHERE a.kind = ${Kind.movie} AND um.user_id = ${userId} AND um.movie_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM user_shows us WHERE a.kind = ${Kind.show} AND us.user_id = ${userId} AND us.show_id = a.id)
          AND NOT EXISTS (SELECT 1 FROM user_feedback f WHERE f.user_id = ${userId} AND f.kind = a.kind AND f.item_id = a.id)
        ORDER BY a.cf DESC
        LIMIT ${Math.max(tuning.candidatePool, limit * 12)}`)),
    ];
  }

  const seedName = new Map(seeds.map((s) => [`${s.kind}:${s.id}`, s.name]));
  const scored = candidates.map((c) => {
    const q = (c.vote_count * c.vote_average + BAYES_M * BAYES_C) / (c.vote_count + BAYES_M);
    const quality = Math.min(1.3, Math.max(0.2, (q - 5) / 3));
    const gs = c.genre_ids ?? [];
    const aff = gs.length ? gs.reduce((a, g) => a + (profile.get(g) ?? 0), 0) / gs.length : 0;
    const fit = notorietyFit(c.vote_count, notoriety) ** tuning.popularityFit;
    return {
      c,
      score: c.cf ** tuning.cfExponent * quality * (1 + 0.5 * aff) * fit,
      reason:
        c.support > 2
          ? `Proche de ${seedName.get(`${c.top_seed_kind}:${c.top_seed_id}`)} et ${c.support - 1} autres titres que tu as aimés`
          : `Parce que tu as aimé ${seedName.get(`${c.top_seed_kind}:${c.top_seed_id}`)}`,
    };
  });

  const picked = diversify(scored, limit, tuning);
  const out: Recommendation[] = picked.map(({ c, score, reason }) => ({
    kind: c.kind === Kind.movie ? "movie" : "show",
    id: c.id,
    title: c.title,
    poster_path: c.poster_path,
    year: c.year,
    score: Math.round(score * 1000) / 1000,
    reason,
  }));

  // Démarrage à froid (ou historique trop maigre) : titres populaires, triés par affinité.
  if (out.length < limit) out.push(...(await coldStart(userId, wanted, profile, limit - out.length, new Set(out.map((r) => `${r.kind}:${r.id}`)))));
  return out;
}

/** Re-classement glouton : pénalise la répétition d'une même graine ou d'un même genre principal. */
function diversify<T extends { c: Candidate; score: number }>(items: T[], limit: number, tuning: Tuning) {
  const pool = [...items].sort((a, b) => b.score - a.score);
  const bySeed = new Map<string, number>();
  const byGenre = new Map<number, number>();
  const out: T[] = [];
  while (out.length < limit && pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < Math.min(pool.length, 60); i++) {
      const it = pool[i];
      const s = `${it.c.top_seed_kind}:${it.c.top_seed_id}`;
      const g = it.c.genre_ids?.[0] ?? -1;
      const adj = it.score * tuning.diversitySeed ** (bySeed.get(s) ?? 0) * tuning.diversityGenre ** (byGenre.get(g) ?? 0);
      if (adj > bestScore) {
        bestScore = adj;
        best = i;
      }
    }
    const [it] = pool.splice(best, 1);
    out.push(it);
    const s = `${it.c.top_seed_kind}:${it.c.top_seed_id}`;
    bySeed.set(s, (bySeed.get(s) ?? 0) + 1);
    const g = it.c.genre_ids?.[0] ?? -1;
    byGenre.set(g, (byGenre.get(g) ?? 0) + 1);
  }
  return out;
}

/**
 * Quand le graphe ne suffit pas (nouvel utilisateur, ou séries pour quelqu'un
 * qui n'a noté que des films) : les titres les mieux notés de SES genres
 * préférés, puis les incontournables, triés par affinité.
 */
async function coldStart(userId: number, kinds: number[], profile: Map<number, number>, n: number, exclude: Set<string>) {
  const sources = await Promise.all(
    kinds.map(async (k) => {
      const kname = k === Kind.movie ? "movie" : "tv";
      const fav = [...profile]
        .filter(([g, v]) => v > 0.25 && GENRE_NAMES[g] && toKindGenre(g, k) === g && ![99, 10402, 10764, 10767].includes(g))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
      const lists = await Promise.all([
        ...fav.map((g) =>
          discoverByGenres(kname, [g])
            .then((r) => r.results.map((x) => ({ k, x, reason: `Très bien noté en ${GENRE_NAMES[g]}, un genre que tu aimes` })))
            .catch(() => []),
        ),
        ...(["most_voted", "popular"] as const).map((l) =>
          fetchList(kname, l, 1)
            .then((r) => r.results.map((x) => ({ k, x, reason: "Incontournable du moment" })))
            .catch(() => []),
        ),
      ]);
      return lists.flat();
    }),
  );
  const all = sources.flat();
  if (!all.length) return [];
  // Retirer ce que l'utilisateur connaît déjà, en une requête.
  const known = new Set(
    (await db.execute<{ k: number; id: number }>(sql`
      SELECT ${Kind.movie}::int AS k, movie_id AS id FROM user_movies WHERE user_id = ${userId}
        AND movie_id = ANY(${pgArray(all.filter((a) => a.k === Kind.movie).map((a) => a.x.id))}::int[])
      UNION ALL
      SELECT ${Kind.show}, show_id FROM user_shows WHERE user_id = ${userId}
        AND show_id = ANY(${pgArray(all.filter((a) => a.k === Kind.show).map((a) => a.x.id))}::int[])
      UNION ALL
      SELECT kind, item_id FROM user_feedback WHERE user_id = ${userId}`)).map((r) => `${r.k}:${r.id}`),
  );
  const seen = new Set<string>();
  return all
    .filter(({ k, x }) => {
      const key = `${k === Kind.movie ? "movie" : "show"}:${x.id}`;
      if (seen.has(key) || exclude.has(key) || known.has(`${k}:${x.id}`)) return false;
      seen.add(key);
      return true;
    })
    .map(({ k, x, reason }) => {
      const gs = x.genre_ids ?? [];
      const aff = gs.length ? gs.reduce((a, g) => a + (profile.get(g) ?? 0), 0) / gs.length : 0;
      const q = ((x.vote_count ?? 0) * (x.vote_average ?? 0) + BAYES_M * BAYES_C) / ((x.vote_count ?? 0) + BAYES_M);
      return {
        kind: (k === Kind.movie ? "movie" : "show") as KindName,
        id: x.id,
        title: x.title ?? x.name ?? "",
        poster_path: x.poster_path,
        year: Number((x.release_date ?? x.first_air_date ?? "").slice(0, 4)) || null,
        // L'affinité de genres pèse lourd ici : c'est notre seul signal personnel.
        score: Math.round(0.01 * q * Math.max(0.1, 1 + 1.5 * aff) * (reason === "Incontournable du moment" ? 0.85 : 1) * 1000) / 1000,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

export async function dismiss(userId: number, kind: KindName, id: number) {
  await db.execute(sql`
    INSERT INTO user_feedback (user_id, kind, item_id, value) VALUES (${userId}, ${kindNum(kind)}, ${id}, -1)
    ON CONFLICT (user_id, kind, item_id) DO UPDATE SET value = -1, created_at = now()`);
}

// ─────────────────────── Filtrage collaboratif (job de nuit) ───────────────────────

/**
 * Liens « co-visionnage » calculés sur nos propres utilisateurs :
 *   sim(a, b) = nb_users(a ∩ b) / √(nb_users(a) × nb_users(b))   (cosinus binaire)
 * Seuls les visionnages « positifs » comptent (note ≥ 6/10 ou pas de note, séries
 * non abandonnées avec ≥ 3 épisodes). On plafonne à 100 titres par utilisateur
 * (les plus récents) pour borner le coût en O(users × 100²), et on garde les 30
 * meilleurs voisins par titre.
 *
 * Tient très bien jusqu'à ~100 k utilisateurs actifs dans Postgres. Au-delà :
 * même calcul dans un job batch dédié (DuckDB/Spark) qui réécrit item_links.
 */
export async function buildCollabLinks(minUsers = 3) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL work_mem = '256MB'`);
    await tx.execute(sql`
      CREATE TEMP TABLE ui ON COMMIT DROP AS
      SELECT user_id, kind, id FROM (
        SELECT user_id, kind, id, row_number() OVER (PARTITION BY user_id ORDER BY ts DESC) AS rn FROM (
          SELECT user_id, ${Kind.movie}::smallint AS kind, movie_id AS id, coalesce(watched_at, added_at) AS ts
          FROM user_movies WHERE status = 1 AND coalesce(rating, 7) >= 6
          UNION ALL
          SELECT user_id, ${Kind.show}::smallint, show_id, coalesce(last_watched_at, added_at)
          FROM user_shows WHERE watched_count >= 3 AND status <> 3 AND coalesce(rating, 7) >= 6
        ) x
      ) y WHERE rn <= 100`);
    await tx.execute(sql`
      CREATE TEMP TABLE item_n ON COMMIT DROP AS
      SELECT kind, id, count(*)::real AS n FROM ui GROUP BY 1, 2 HAVING count(*) >= ${minUsers}`);
    await tx.execute(sql`DELETE FROM ui WHERE (kind, id) NOT IN (SELECT kind, id FROM item_n)`);
    await tx.execute(sql`CREATE INDEX ON ui (user_id)`);
    await tx.execute(sql`DELETE FROM item_links WHERE source = ${LinkSource.collab}`);
    const [r] = await tx.execute<{ n: number }>(sql`
      WITH ins AS (
      INSERT INTO item_links (src_kind, src_id, source, dst_kind, dst_id, score)
      SELECT ak, ai, ${LinkSource.collab}, bk, bi, sim FROM (
        SELECT p.ak, p.ai, p.bk, p.bi, (p.c / sqrt(na.n * nb.n))::real AS sim,
               row_number() OVER (PARTITION BY p.ak, p.ai ORDER BY p.c / sqrt(na.n * nb.n) DESC) AS rk
        FROM (
          SELECT a.kind AS ak, a.id AS ai, b.kind AS bk, b.id AS bi, count(*)::real AS c
          FROM ui a JOIN ui b ON a.user_id = b.user_id AND (a.kind, a.id) <> (b.kind, b.id)
          GROUP BY 1, 2, 3, 4
          HAVING count(*) >= ${minUsers}
        ) p
        JOIN item_n na ON na.kind = p.ak AND na.id = p.ai
        JOIN item_n nb ON nb.kind = p.bk AND nb.id = p.bi
      ) z WHERE rk <= 30
      RETURNING 1)
      SELECT count(*)::int AS n FROM ins`);
    // Les titres du catalogue complet ont aussi besoin d'une fiche légère pour être recommandés.
    await tx.execute(sql`
      INSERT INTO media_summary (kind, id, title, poster_path, year, genre_ids, popularity)
      SELECT ${Kind.movie}::smallint, id, title, poster_path, extract(year FROM release_date)::smallint, genre_ids, popularity FROM movies
      UNION ALL
      SELECT ${Kind.show}::smallint, id, name, poster_path, extract(year FROM first_air_date)::smallint, genre_ids, popularity FROM shows
      ON CONFLICT (kind, id) DO NOTHING`);
    return { links: r.n };
  });
}
