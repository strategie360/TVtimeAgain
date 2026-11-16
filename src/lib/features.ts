/**
 * Signaux de contenu pour les recommandations : réalisateurs (créateurs pour les séries), acteurs principaux
 * et mots-clés TMDB. Récupérés une fois par titre pour tout le monde (1 appel TMDB avec append_to_response).
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Kind } from "@/db/schema";
import { pgArray } from "./catalog";
import { toSummary, upsertSummaries } from "./media-summary";
import { tmdb, TmdbError, type TmdbListItem } from "./tmdb";

export type Features = { directors: number[]; cast: number[]; keywords: number[] };
type Person = { id: number; name: string };

const CAST_SIZE = 5;

type MovieDetail = {
  keywords?: { keywords?: { id: number }[] };
  credits?: { cast?: (Person & { order?: number })[]; crew?: (Person & { job?: string })[] };
};
type ShowDetail = {
  created_by?: Person[];
  keywords?: { results?: { id: number }[] };
  aggregate_credits?: { cast?: (Person & { order?: number })[] };
};

async function fetchFeatures(kind: number, id: number): Promise<{ features: Features; people: Person[] }> {
  if (kind === Kind.movie) {
    const d = await tmdb<MovieDetail>(`/movie/${id}`, { params: { append_to_response: "keywords,credits" } });
    const directors = (d.credits?.crew ?? []).filter((p) => p.job === "Director");
    const cast = [...(d.credits?.cast ?? [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, CAST_SIZE);
    return {
      features: { directors: directors.map((p) => p.id), cast: cast.map((p) => p.id), keywords: (d.keywords?.keywords ?? []).map((k) => k.id) },
      people: [...directors, ...cast],
    };
  }
  const d = await tmdb<ShowDetail>(`/tv/${id}`, { params: { append_to_response: "keywords,aggregate_credits" } });
  const creators = d.created_by ?? [];
  const cast = [...(d.aggregate_credits?.cast ?? [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, CAST_SIZE);
  return {
    features: { directors: creators.map((p) => p.id), cast: cast.map((p) => p.id), keywords: (d.keywords?.results ?? []).map((k) => k.id) },
    people: [...creators, ...cast],
  };
}

const inflight = new Map<string, Promise<void>>();

/** Récupère et enregistre les signaux d'un titre (une fois pour tout le monde). Un 404 enregistre des signaux vides. */
export function ensureFeatures(kind: number, id: number) {
  const key = `${kind}:${id}`;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      const { features, people } = await fetchFeatures(kind, id).catch((e) => {
        if (e instanceof TmdbError && e.status === 404) return { features: { directors: [], cast: [], keywords: [] }, people: [] };
        throw e;
      });
      const uniq = [...new Map(people.map((p) => [p.id, p])).values()];
      await db.transaction(async (tx) => {
        if (uniq.length) {
          await tx.execute(sql`
            INSERT INTO people (id, name)
            SELECT * FROM unnest(${pgArray(uniq.map((p) => p.id))}::int[], ${pgArray(uniq.map((p) => p.name))}::text[])
            ON CONFLICT (id) DO UPDATE SET name = excluded.name`);
        }
        await tx.execute(sql`
          INSERT INTO media_features (kind, id, directors, "cast", keywords, fetched_at)
          VALUES (${kind}, ${id}, ${pgArray(features.directors)}::int[], ${pgArray(features.cast)}::int[],
                  ${pgArray(features.keywords)}::int[], now())
          ON CONFLICT (kind, id) DO UPDATE SET directors = excluded.directors, "cast" = excluded."cast",
            keywords = excluded.keywords, fetched_at = now()`);
      });
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

const CREDITS_TTL_DAYS = 30;
const creditsInflight = new Map<number, Promise<void>>();

/**
 * Filmographie de réalisateur d'une personne (TMDB), une fois pour tout le monde puis tous les 30 jours.
 * Les films obtiennent une fiche légère pour pouvoir être recommandés.
 */
export function ensureDirectorCredits(personId: number) {
  let p = creditsInflight.get(personId);
  if (!p) {
    p = (async () => {
      const [fresh] = await db.execute(sql`
        SELECT 1 FROM people WHERE id = ${personId}
          AND credits_fetched_at > now() - ${`${CREDITS_TTL_DAYS} days`}::interval`);
      if (fresh) return;
      const r = await tmdb<{ crew?: (TmdbListItem & { job?: string })[] }>(`/person/${personId}/movie_credits`).catch((e) => {
        if (e instanceof TmdbError && e.status === 404) return { crew: [] };
        throw e;
      });
      const films = [...new Map((r.crew ?? []).filter((c) => c.job === "Director").map((c) => [c.id, c])).values()];
      await upsertSummaries(films.map((f) => toSummary(Kind.movie, f)));
      await db.transaction(async (tx) => {
        if (films.length) {
          await tx.execute(sql`
            INSERT INTO director_credits (person_id, movie_id)
            SELECT ${personId}, x FROM unnest(${pgArray(films.map((f) => f.id))}::int[]) x
            ON CONFLICT DO NOTHING`);
        }
        await tx.execute(sql`UPDATE people SET credits_fetched_at = now() WHERE id = ${personId}`);
      });
    })().finally(() => creditsInflight.delete(personId));
    creditsInflight.set(personId, p);
  }
  return p;
}

/** Signaux déjà connus pour une liste de titres (clé « kind:id »). Les titres absents n'ont pas encore été récupérés. */
export async function loadFeatures(items: { kind: number; id: number }[]) {
  const out = new Map<string, Features>();
  if (!items.length) return out;
  const rows = await db.execute<{ kind: number; id: number; directors: number[]; cast: number[]; keywords: number[] }>(sql`
    SELECT f.kind, f.id, f.directors, f."cast", f.keywords
    FROM media_features f
    JOIN unnest(${pgArray(items.map((i) => i.kind))}::smallint[], ${pgArray(items.map((i) => i.id))}::int[]) AS u(kind, id)
      ON u.kind = f.kind AND u.id = f.id`);
  for (const r of rows) out.set(`${r.kind}:${r.id}`, { directors: r.directors, cast: r.cast, keywords: r.keywords });
  return out;
}

// ─────────────────────────── Profil de contenu ───────────────────────────

/** Poids relatifs : un réalisateur dit plus de vos goûts qu'un acteur ou un mot-clé. */
export const FEATURE_WEIGHTS = { director: 3, cast: 1, keyword: 1 };

const featureKeys = (f: Features) => [
  ...f.directors.map((id) => `d${id}`),
  ...f.cast.map((id) => `c${id}`),
  ...f.keywords.map((id) => `k${id}`),
];
const typeWeight = (key: string) =>
  key[0] === "d" ? FEATURE_WEIGHTS.director : key[0] === "c" ? FEATURE_WEIGHTS.cast : FEATURE_WEIGHTS.keyword;

export type ContentProfile = Map<string, number>;

/**
 * Profil de contenu : pour chaque réalisateur, acteur ou mot-clé, somme des poids des titres qui le portent,
 * multipliée par sa rareté dans l'historique (un mot-clé présent partout, comme « based on novel », ne dit rien).
 */
export function contentProfile(seeds: { w: number; features: Features | undefined }[]): ContentProfile {
  const withFeatures = seeds.filter((s) => s.features);
  const df = new Map<string, number>();
  for (const s of withFeatures) for (const k of new Set(featureKeys(s.features!))) df.set(k, (df.get(k) ?? 0) + 1);
  const n = withFeatures.length;
  const profile: ContentProfile = new Map();
  for (const s of withFeatures) {
    for (const k of new Set(featureKeys(s.features!))) {
      const idf = Math.log(1 + n / df.get(k)!);
      profile.set(k, (profile.get(k) ?? 0) + s.w * idf * typeWeight(k));
    }
  }
  return profile;
}

/** Ressemblance de contenu d'un candidat avec le profil (≥ 0 ; 0 sans signaux connus). */
export function contentScore(features: Features | undefined, profile: ContentProfile) {
  if (!features) return 0;
  const keys = featureKeys(features);
  if (!keys.length) return 0;
  let s = 0;
  for (const k of keys) s += profile.get(k) ?? 0;
  return Math.max(0, s) / Math.sqrt(keys.length);
}

/** La personne (réalisateur d'abord) qui rapproche le plus ce candidat des goûts de l'utilisateur. */
export function topPerson(features: Features | undefined, profile: ContentProfile) {
  if (!features) return null;
  let best: { id: number; role: "director" | "cast"; score: number } | null = null;
  for (const id of features.directors) {
    const v = profile.get(`d${id}`) ?? 0;
    if (v > 0 && (!best || v > best.score)) best = { id, role: "director", score: v };
  }
  for (const id of features.cast) {
    const v = profile.get(`c${id}`) ?? 0;
    if (v > 0 && (!best || v > best.score)) best = { id, role: "cast", score: v };
  }
  return best;
}
