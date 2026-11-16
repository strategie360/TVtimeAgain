import { afterEach, describe, expect, it, vi } from "vitest";
import { findLetterboxdTitle, matchScore, type TmdbListItem } from "@/lib/tmdb";
import { matchKey } from "@/lib/imports";

const film = (id: number, title: string, year: string, votes: number, original = title): TmdbListItem & { original_title: string } => ({
  id,
  title,
  original_title: original,
  release_date: `${year}-06-01`,
  vote_count: votes,
  poster_path: null,
});

describe("matchScore", () => {
  it("prefers the real film over a better-ranked making-of", () => {
    const real = film(146, "Crouching Tiger, Hidden Dragon", "2000", 4000, "臥虎藏龍");
    const makingOf = film(9, "The Making of 'Crouching Tiger, Hidden Dragon'", "2000", 12);
    expect(matchScore("Crouching Tiger, Hidden Dragon", 2000, real)).toBeGreaterThan(
      matchScore("Crouching Tiger, Hidden Dragon", 2000, makingOf),
    );
  });

  it("uses the year to separate remakes", () => {
    const dune84 = film(841, "Dune", "1984", 3000);
    const dune21 = film(438631, "Dune", "2021", 13000);
    expect(matchScore("Dune", 1984, dune84)).toBeGreaterThan(matchScore("Dune", 1984, dune21));
  });

  it("ignores accents, case and punctuation when comparing titles", () => {
    expect(matchScore("amelie", 2001, film(194, "Amélie", "2001", 100))).toBeGreaterThanOrEqual(6);
  });

  it("never matches a title with no relation to the query", () => {
    expect(matchScore("Heat", 1995, film(1, "Toy Story", "1995", 18000))).toBe(-Infinity);
  });
});

describe("findLetterboxdTitle", () => {
  afterEach(() => vi.unstubAllGlobals());

  type Item = TmdbListItem & { original_title?: string; original_name?: string };
  const show = (id: number, name: string, year: string, votes: number): Item => ({ id, name, first_air_date: `${year}-05-06`, vote_count: votes, poster_path: null });

  /** Faux TMDB : réponses selon le type de recherche (film ou série) et le texte cherché. */
  function stubTmdb(byPath: { movie?: (query: string) => Item[]; tv?: (query: string) => Item[] }) {
    const fetchMock = vi.fn(async (input: URL | string) => {
      const url = new URL(String(input));
      const query = url.searchParams.get("query") ?? "";
      const kind = url.pathname.endsWith("/search/tv") ? "tv" : "movie";
      const results = byPath[kind]?.(query) ?? [];
      return new Response(JSON.stringify({ results, total_pages: 1 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }
  const urls = (m: ReturnType<typeof stubTmdb>) => m.mock.calls.map((c) => String((c as unknown as [URL])[0]));

  it("returns an exact film directly, searching in English with and without the year", async () => {
    const fetchMock = stubTmdb({ movie: () => [film(9, "The Thing", "2011", 3000), film(1091, "The Thing", "1982", 7000)] });
    expect(await findLetterboxdTitle("The Thing", 1982)).toMatchObject({ kind: "movie", item: { id: 1091 } });
    expect(urls(fetchMock)).toHaveLength(2); // pas de recherche de série quand le film est exact
    expect(urls(fetchMock).every((u) => u.includes("language=en-US"))).toBe(true);
    expect(urls(fetchMock).some((u) => u.includes("year=1982"))).toBe(true);
  });

  it("never takes a film that merely contains the title (Loki -> a Simpsons short)", async () => {
    stubTmdb({ movie: () => [film(846214, "The Good, the Bart, and the Loki", "2021", 400)], tv: () => [show(84958, "Loki", "2021", 11000)] });
    expect(await findLetterboxdTitle("Loki", 2021)).toMatchObject({ kind: "show", item: { id: 84958 } });
  });

  it("prefers the series over an exact-title film that is barely known (2 votes, no date)", async () => {
    stubTmdb({
      movie: () => [{ id: 1178202, title: "Loki", vote_count: 2, poster_path: null }],
      tv: () => [show(84958, "Loki", "2021", 12909)],
    });
    expect(await findLetterboxdTitle("Loki", 2021)).toMatchObject({ kind: "show", item: { id: 84958 } });
  });

  it("keeps a little-known exact film when no series has that title", async () => {
    stubTmdb({ movie: () => [film(77, "Jacquot de Nantes", "1991", 60)], tv: () => [] });
    expect(await findLetterboxdTitle("Jacquot de Nantes", 1991)).toMatchObject({ kind: "movie", item: { id: 77 } });
  });

  it("does not take a series from another decade with the same title", async () => {
    stubTmdb({ movie: () => [film(12, "Planet X", "2010", 40)], tv: () => [show(13, "Planet X", "1985", 900)] });
    expect(await findLetterboxdTitle("Planet X", 2010)).toMatchObject({ kind: "movie", item: { id: 12 } });
  });

  it("prefers a much more voted mini-series over a film with a longer title", async () => {
    stubTmdb({ movie: () => [film(793445, "Chernobyl: Zone of Exclusion", "2019", 60)], tv: () => [show(87108, "Chernobyl", "2019", 7000)] });
    expect(await findLetterboxdTitle("Chernobyl", 2019)).toMatchObject({ kind: "show", item: { id: 87108 } });
  });

  it("keeps a film with a longer official title when no series matches (Glass Onion)", async () => {
    stubTmdb({ movie: () => [film(661374, "Glass Onion: A Knives Out Mystery", "2022", 6000)], tv: () => [] });
    expect(await findLetterboxdTitle("Glass Onion", 2022)).toMatchObject({ kind: "movie", item: { id: 661374 } });
  });

  it("retries a long title with its beginning when the full search finds nothing", async () => {
    const full = "Jeanne Dielman, 23, quai du Commerce, 1080 Bruxelles";
    const fetchMock = stubTmdb({
      movie: (q) => (q === "Jeanne Dielman" ? [film(44012, "Jeanne Dielman, 23 Quai du Commerce, 1080 Brussels", "1975", 900, full)] : []),
    });
    expect(await findLetterboxdTitle(full, 1975)).toMatchObject({ kind: "movie", item: { id: 44012 } });
    expect(urls(fetchMock).some((u) => u.includes("query=Jeanne+Dielman&"))).toBe(true);
  });

  it("returns null rather than a wrong title when nothing is close enough", async () => {
    stubTmdb({ movie: () => [film(5, "Something Else Entirely", "2011", 50)] });
    expect(await findLetterboxdTitle("Ceci N'existe Pas", 2011)).toBeNull();
  });
});

describe("matchKey", () => {
  it("normalises case and whitespace so the shared cache is hit", () => {
    expect(matchKey("  The   Matrix ", 1999)).toBe(matchKey("the matrix", 1999));
    expect(matchKey("Dune", 1984)).not.toBe(matchKey("Dune", 2021));
    expect(matchKey("Dune", null)).toBe("dune|");
  });
});
