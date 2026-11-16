import { afterEach, describe, expect, it, vi } from "vitest";
import { findMovie, matchScore, type TmdbListItem } from "@/lib/tmdb";
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

describe("findMovie", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubTmdb(results: TmdbListItem[]) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results, total_pages: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("searches in English, with and without the year, and returns the best candidate", async () => {
    const fetchMock = stubTmdb([film(9, "The Thing", "2011", 3000), film(1091, "The Thing", "1982", 7000)]);
    const best = await findMovie("The Thing", 1982);
    expect(best?.id).toBe(1091);
    const urls = fetchMock.mock.calls.map((c) => String((c as unknown as [URL])[0]));
    expect(urls).toHaveLength(2);
    expect(urls.every((u) => u.includes("language=en-US"))).toBe(true);
    expect(urls.some((u) => u.includes("year=1982"))).toBe(true);
  });

  it("returns null rather than a wrong film when nothing is close enough", async () => {
    stubTmdb([film(5, "Something Else Entirely", "2011", 50)]);
    expect(await findMovie("Ceci N'existe Pas", 2011)).toBeNull();
  });
});

describe("matchKey", () => {
  it("normalises case and whitespace so the shared cache is hit", () => {
    expect(matchKey("  The   Matrix ", 1999)).toBe(matchKey("the matrix", 1999));
    expect(matchKey("Dune", 1984)).not.toBe(matchKey("Dune", 2021));
    expect(matchKey("Dune", null)).toBe("dune|");
  });
});
