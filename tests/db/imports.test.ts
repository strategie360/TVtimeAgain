import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { createImport, getImport, processImport, type ImportRow } from "@/lib/imports";
import * as tmdb from "@/lib/tmdb";
import { createUser, one, resetDb } from "../helpers/db";

// Réseau simulé : un mini-catalogue TMDB en mémoire.
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  findLetterboxdTitle: vi.fn(),
  fetchMovie: vi.fn(),
}));

const CATALOG: Record<string, { id: number; title: string; runtime: number }> = {
  "inception|2010": { id: 27205, title: "Inception", runtime: 148 },
  "heat|1995": { id: 949, title: "Heat", runtime: 170 },
  "seven samurai|1954": { id: 346, title: "Seven Samurai", runtime: 207 },
};
/** Mini-séries que Letterboxd liste comme des films. */
const SHOWS: Record<string, { id: number; name: string }> = {
  "chernobyl|2019": { id: 87108, name: "Chernobyl" },
};

const row = (name: string, year: number | null, extra: Partial<ImportRow> = {}): ImportRow => ({
  name,
  year,
  watched: true,
  watchedAt: "2024-01-31",
  rating: null,
  plays: 1,
  ...extra,
});

let user: number;

beforeEach(async () => {
  await resetDb();
  user = await createUser();
  vi.mocked(tmdb.findLetterboxdTitle).mockReset().mockImplementation(async (name, year) => {
    const key = `${name.toLowerCase()}|${year}`;
    const m = CATALOG[key];
    if (m) return { kind: "movie", item: { id: m.id, title: m.title, poster_path: null } };
    const sh = SHOWS[key];
    return sh ? { kind: "show", item: { id: sh.id, name: sh.name, poster_path: null } } : null;
  });
  vi.mocked(tmdb.fetchMovie).mockReset().mockImplementation(async (id) => {
    const m = Object.values(CATALOG).find((x) => x.id === id)!;
    return { id, title: m.title, overview: null, poster_path: null, backdrop_path: null, release_date: "2000-01-01", runtime: m.runtime, popularity: 1 };
  });
});

async function runImport(rows: ImportRow[]) {
  const id = await createImport(user, "letterboxd", rows);
  await processImport(id);
  return (await getImport(user, id))!;
}

describe("Letterboxd import", () => {
  it("adds matched films with their rating, plays and date, and reports the unknown ones", async () => {
    const imp = await runImport([
      row("Inception", 2010, { rating: 9, plays: 2, watchedAt: "2025-05-30" }),
      row("Heat", 1995),
      row("Seven Samurai", 1954, { watched: false, watchedAt: null, plays: 0 }),
      row("Ceci N'existe Pas", 2011),
    ]);

    expect(imp).toMatchObject({ status: 2, total: 4, processed: 4, matched: 3 });
    expect(imp.not_found).toEqual([{ name: "Ceci N'existe Pas", year: 2011 }]);

    const movies = await db.execute<{ movie_id: number; status: number; rating: number | null; plays: number; watched: string | null }>(sql`
      SELECT movie_id, status, rating, plays, watched_at::date::text AS watched FROM user_movies WHERE user_id = ${user} ORDER BY movie_id`);
    expect([...movies]).toEqual([
      { movie_id: 346, status: 0, rating: null, plays: 0, watched: null }, // watchlist
      { movie_id: 949, status: 1, rating: null, plays: 1, watched: "2024-01-31" },
      { movie_id: 27205, status: 1, rating: 9, plays: 2, watched: "2025-05-30" },
    ]);
  });

  it("lists mini-series separately instead of importing them as films", async () => {
    const imp = await runImport([row("Heat", 1995), row("Chernobyl", 2019, { rating: 10 }), row("Chernobyl", 2019)]);
    expect(imp).toMatchObject({ matched: 1, not_found: [] });
    expect(imp.shows).toEqual([{ name: "Chernobyl", year: 2019, show_id: 87108 }]);
    expect(await one(sql`SELECT count(*)::int AS n FROM user_movies WHERE user_id = ${user}`)).toEqual({ n: 1 });
  });

  it("caches a detected series for everyone, like a film", async () => {
    await runImport([row("Chernobyl", 2019)]);
    const other = await createUser("carol");
    vi.mocked(tmdb.findLetterboxdTitle).mockClear();
    const id = await createImport(other, "letterboxd", [row("Chernobyl", 2019)]);
    await processImport(id);
    expect(tmdb.findLetterboxdTitle).not.toHaveBeenCalled();
    expect((await getImport(other, id))?.shows).toEqual([{ name: "Chernobyl", year: 2019, show_id: 87108 }]);
  });

  it("recomputes the user's film counters from the imported rows", async () => {
    await runImport([row("Inception", 2010, { plays: 2 }), row("Heat", 1995)]);
    expect(await one(sql`SELECT movies_watched, movie_minutes FROM users WHERE id = ${user}`)).toEqual({
      movies_watched: 2,
      movie_minutes: 2 * 148 + 170,
    });
  });

  it("caches matches for everyone: a second import of the same titles makes no TMDB call", async () => {
    await runImport([row("Inception", 2010), row("Nope", 2000)]);
    const other = await createUser("bob");
    vi.mocked(tmdb.findLetterboxdTitle).mockClear();
    vi.mocked(tmdb.fetchMovie).mockClear();

    const id = await createImport(other, "letterboxd", [row("INCEPTION", 2010), row("Nope", 2000)]);
    await processImport(id);

    expect(tmdb.findLetterboxdTitle).not.toHaveBeenCalled(); // y compris pour le titre introuvable
    expect(tmdb.fetchMovie).not.toHaveBeenCalled();
    expect((await getImport(other, id))?.matched).toBe(1);
  });

  it("does not downgrade a film already watched when it also appears in the watchlist", async () => {
    await runImport([row("Heat", 1995, { rating: 8 })]);
    await runImport([row("Heat", 1995, { watched: false, watchedAt: null, plays: 0 })]);
    expect(await one(sql`SELECT status, rating, plays FROM user_movies WHERE user_id = ${user} AND movie_id = 949`)).toEqual({
      status: 1,
      rating: 8,
      plays: 1,
    });
  });

  it("only one worker processes an import at a time (lease)", async () => {
    const id = await createImport(user, "letterboxd", [row("Heat", 1995)]);
    await Promise.all([processImport(id), processImport(id)]);
    expect(tmdb.findLetterboxdTitle).toHaveBeenCalledTimes(1);
    expect((await getImport(user, id))?.processed).toBe(1);
  });

  it("does not show another user's import", async () => {
    const id = await createImport(user, "letterboxd", [row("Heat", 1995)]);
    const other = await createUser("eve");
    expect(await getImport(other, id)).toBeNull();
  });
});
