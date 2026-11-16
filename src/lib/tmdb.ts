/**
 * Client TMDB minimal.
 *
 * Optimisations :
 *  - Les utilisateurs ne parlent JAMAIS à TMDB directement : seul le serveur
 *    l'appelle, pour remplir le catalogue partagé (une série = synchronisée une
 *    fois pour tous ses spectateurs).
 *  - append_to_response : une série de 19 saisons = 2 requêtes au lieu de 20.
 *  - Sémaphore global + retry sur 429 (Retry-After) pour rester sous la limite.
 *  - Timeout pour ne jamais bloquer une requête utilisateur.
 */
const BASE = "https://api.themoviedb.org/3";
const MAX_CONCURRENCY = 16;
const MAX_APPEND = 20; // limite TMDB pour append_to_response

let active = 0;
const queue: (() => void)[] = [];
async function acquire() {
  if (active < MAX_CONCURRENCY) {
    active++;
    return;
  }
  await new Promise<void>((r) => queue.push(r));
  active++;
}
function release() {
  active--;
  queue.shift()?.();
}

export class TmdbError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Init = { revalidate?: number; params?: Record<string, string | number | undefined> };

export async function tmdb<T>(path: string, init: Init = {}): Promise<T> {
  const token = process.env.TMDB_TOKEN;
  if (!token) throw new TmdbError(500, "TMDB_TOKEN manquant (voir .env.example)");

  const url = new URL(BASE + path);
  url.searchParams.set("language", process.env.TMDB_LANGUAGE ?? "fr-FR");
  for (const [k, v] of Object.entries(init.params ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  for (let attempt = 0; ; attempt++) {
    await acquire();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        // Cache de données Next.js : les recherches identiques ne repartent pas chez TMDB.
        ...(init.revalidate ? { next: { revalidate: init.revalidate } } : { cache: "no-store" }),
      });
    } finally {
      release();
    }
    if (res.status === 429 && attempt < 4) {
      const wait = Number(res.headers.get("retry-after") ?? 1) * 1000;
      await new Promise((r) => setTimeout(r, wait + Math.random() * 250));
      continue;
    }
    if (res.status >= 500 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new TmdbError(res.status, `TMDB ${res.status} sur ${path}`);
    return (await res.json()) as T;
  }
}

// ─────────────── Types (uniquement les champs utilisés) ───────────────

export type TmdbEpisode = {
  id: number;
  season_number: number;
  episode_number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
};
export type TmdbSeason = { season_number: number; episodes?: TmdbEpisode[] };
export type TmdbShow = {
  id: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  status: string | null;
  networks?: { name: string }[];
  genres?: { id: number }[];
  episode_run_time?: number[];
  number_of_seasons: number;
  popularity: number;
  seasons: { season_number: number }[];
};
export type TmdbMovie = {
  id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres?: { id: number }[];
  popularity: number;
};
export type TmdbSearchItem = {
  id: number;
  media_type: "tv" | "movie" | "person";
  name?: string;
  title?: string;
  poster_path: string | null;
  first_air_date?: string;
  release_date?: string;
  overview?: string;
  popularity: number;
};

/** Série + toutes ses saisons/épisodes, en ceil(saisons/20)+1 requêtes. */
export async function fetchShowWithEpisodes(id: number) {
  const show = await tmdb<TmdbShow>(`/tv/${id}`);
  const seasonNumbers = show.seasons.map((s) => s.season_number);
  const chunks: number[][] = [];
  for (let i = 0; i < seasonNumbers.length; i += MAX_APPEND) {
    chunks.push(seasonNumbers.slice(i, i + MAX_APPEND));
  }
  const parts = await Promise.all(
    chunks.map((c) =>
      tmdb<Record<string, TmdbSeason>>(`/tv/${id}`, {
        params: { append_to_response: c.map((n) => `season/${n}`).join(",") },
      }),
    ),
  );
  const episodes: TmdbEpisode[] = [];
  for (const part of parts) {
    for (const [key, season] of Object.entries(part)) {
      if (key.startsWith("season/") && season?.episodes) episodes.push(...season.episodes);
    }
  }
  return { show, episodes };
}

export const fetchMovie = (id: number) => tmdb<TmdbMovie>(`/movie/${id}`);

export async function searchMulti(query: string) {
  const r = await tmdb<{ results: TmdbSearchItem[] }>("/search/multi", {
    params: { query, include_adult: "false" },
    revalidate: 60 * 60 * 24, // une recherche identique est servie depuis le cache 24 h
  });
  return r.results.filter((x) => x.media_type !== "person");
}

/** IDs modifiés chez TMDB depuis `start` (YYYY-MM-DD), toutes pages. */
export async function fetchChanges(kind: "tv" | "movie", start: string, end: string) {
  type Page = { results: { id: number }[]; total_pages: number };
  const get = (page: number) =>
    tmdb<Page>(`/${kind}/changes`, { params: { start_date: start, end_date: end, page } });
  // Page 1 donne le nombre total ; les suivantes partent en parallèle
  // (bornées par le sémaphore global) : ~450 pages en quelques secondes au lieu d'une minute.
  const first = await get(1);
  const total = Math.min(first.total_pages, 500);
  const rest = await Promise.all(Array.from({ length: total - 1 }, (_, i) => get(i + 2)));
  return [...new Set([first, ...rest].flatMap((p) => p.results.map((x) => x.id)))];
}

export function img(path: string | null | undefined, size: "w92" | "w185" | "w342" | "w780" | "w300" = "w342") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

// ─────────────── Recherche ciblée, listes, recommandations ───────────────

export type TmdbListItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  media_type?: string;
};
type Paged = { results: TmdbListItem[]; total_pages: number };

const norm = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const NOISE = /\b(making of|behind the scenes|featurette|documentary|the story of|remastered)\b/;

/**
 * Score de correspondance d'un résultat TMDB avec une ligne Letterboxd.
 * TMDB trie par popularité : le 1er résultat peut être un making-of ou un
 * homonyme. On note donc chaque candidat : titre exact > titre contenu,
 * même année > ±1 an, nombre de votes (le « vrai » film en a beaucoup plus),
 * pénalité pour les bonus/documentaires que la requête ne demandait pas.
 */
export function matchScore(name: string, year: number | null, r: TmdbListItem & { original_title?: string }) {
  const q = norm(name);
  const titles = [r.title, r.original_title].filter(Boolean).map((t) => norm(t!));
  let s = 0;
  if (titles.includes(q)) s += 6;
  else if (titles.some((t) => t.startsWith(q) || q.startsWith(t))) s += 2;
  else if (titles.some((t) => t.includes(q) || q.includes(t))) s += 1;
  else return -Infinity; // aucun lien de titre : jamais retenu, même populaire et de la bonne année
  const y = Number(r.release_date?.slice(0, 4));
  if (year && y) s += y === year ? 3 : Math.abs(y - year) === 1 ? 1.5 : -3;
  s += Math.log10((r.vote_count ?? 0) + 1); // 10 votes : +1 ; 10 000 votes : +4
  if (titles.some((t) => NOISE.test(t)) && !NOISE.test(q)) s -= 6;
  return s;
}

/**
 * Trouve un film par titre + année (import Letterboxd). Recherche en anglais
 * (langue des titres Letterboxd), avec puis sans l'année, et garde le
 * meilleur score.
 */
export async function findMovie(name: string, year: number | null): Promise<TmdbListItem | null> {
  const search = (extra: Record<string, string | number>) =>
    tmdb<Paged>("/search/movie", { params: { query: name, language: "en-US", ...extra } }).then((r) => r.results);
  const [withYear, without] = await Promise.all([year ? search({ year }) : Promise.resolve([]), search({})]);
  const all = [...new Map([...withYear, ...without].map((r) => [r.id, r])).values()];
  let best: TmdbListItem | null = null;
  let bestScore = 3.5; // seuil : en dessous, on préfère « introuvable » à une erreur
  for (const r of all) {
    const sc = matchScore(name, year, r);
    if (sc > bestScore) {
      bestScore = sc;
      best = r;
    }
  }
  return best;
}

/**
 * Listes TMDB pour la sélection rapide (identiques pour tous : cache 24 h).
 *  - most_voted : les titres avec le plus de votes = ceux que le plus de gens ont vus
 *    (la liste « top_rated » de TMDB est polluée par des titres récents à peu de votes)
 *  - popular    : la tendance du moment
 */
export async function fetchList(kind: "movie" | "tv", list: "most_voted" | "popular", page: number) {
  if (list === "popular") return tmdb<Paged>(`/${kind}/popular`, { params: { page }, revalidate: 86400 });
  return tmdb<Paged>(`/discover/${kind}`, {
    params: { page, sort_by: "vote_count.desc", include_adult: "false" },
    revalidate: 86400,
  });
}

export async function fetchRecommendations(kind: "movie" | "tv", id: number) {
  return (await tmdb<Paged>(`/${kind}/${id}/recommendations`, { params: { page: 1 } })).results;
}

/** Découverte par genres (démarrage à froid personnalisé). Cache 24 h : partagé entre users aux goûts proches. */
export async function discoverByGenres(kind: "movie" | "tv", genres: number[]) {
  return tmdb<Paged>(`/discover/${kind}`, {
    params: {
      with_genres: genres.join("|"), // OU logique
      sort_by: "vote_count.desc",
      "vote_average.gte": 7.3,
      "vote_count.gte": 300,
      include_adult: "false",
    },
    revalidate: 86400,
  });
}
