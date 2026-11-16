import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { Kind, LinkSource } from "@/db/schema";
import { buildCollabLinks, dismiss, recommend } from "@/lib/recs";
import * as tmdb from "@/lib/tmdb";
import { setMovieRating, markMovieWatched } from "@/lib/tracking";
import { createMovie, createUser, resetDb } from "../helpers/db";

// Aucun appel réseau : les listes de démarrage à froid sont vides, et les graines
// sont déclarées « déjà liées » pour que recommend() ne demande rien à TMDB.
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  fetchRecommendations: vi.fn(async () => []),
  fetchList: vi.fn(async () => ({ results: [], total_pages: 1 })),
  discoverByGenres: vi.fn(async () => ({ results: [], total_pages: 1 })),
}));

const SCIFI = 878;
const COMEDY = 35;

async function summary(id: number, title: string, genres: number[], voteAverage = 7.5, voteCount = 5000) {
  await db.execute(sql`
    INSERT INTO media_summary (kind, id, title, year, genre_ids, vote_average, vote_count)
    VALUES (${Kind.movie}, ${id}, ${title}, 2000, ${`{${genres.join(",")}}`}::smallint[], ${voteAverage}, ${voteCount})`);
}

async function link(src: number, dst: number, score: number, source: number = LinkSource.tmdb) {
  await db.execute(sql`
    INSERT INTO item_links (src_kind, src_id, source, dst_kind, dst_id, score)
    VALUES (${Kind.movie}, ${src}, ${source}, ${Kind.movie}, ${dst}, ${score})`);
  await db.execute(sql`
    INSERT INTO link_fetches (kind, id) VALUES (${Kind.movie}, ${src}) ON CONFLICT DO NOTHING`);
}

let user: number;

beforeEach(async () => {
  await resetDb();
  vi.mocked(tmdb.fetchRecommendations).mockClear();
  user = await createUser();
  // Graines : deux films de SF aimés, une comédie détestée.
  await createMovie(1, { title: "Alien", genreIds: [SCIFI] });
  await createMovie(2, { title: "Arrival", genreIds: [SCIFI] });
  await createMovie(3, { title: "Bad Comedy", genreIds: [COMEDY] });
  // Candidats.
  await summary(10, "Aliens", [SCIFI]);
  await summary(11, "Moon", [SCIFI]);
  await summary(12, "Comedy Sequel", [COMEDY]);
  await summary(13, "Obscure SF", [SCIFI], 9.5, 3);
  await summary(2, "Arrival", [SCIFI]); // déjà vu : ne doit jamais être proposé
  await link(1, 10, 1.0);
  await link(1, 11, 0.6);
  await link(2, 11, 0.6);
  await link(1, 2, 0.9);
  await link(3, 12, 1.0);
  await link(2, 13, 1.0);
  await setMovieRating(user, 1, 10);
  await setMovieRating(user, 2, 9);
  await setMovieRating(user, 3, 2);
});

const titles = (recs: Awaited<ReturnType<typeof recommend>>) => recs.map((r) => r.title);

describe("recommend", () => {
  it("recommends neighbours of liked titles and explains why", async () => {
    const recs = await recommend(user, { kind: "movie", limit: 10 });
    expect(titles(recs)).toContain("Aliens");
    expect(recs.find((r) => r.title === "Aliens")?.reason).toBe("Parce que tu as aimé Alien");
  });

  it("never recommends something already watched", async () => {
    expect(titles(await recommend(user, { kind: "movie" }))).not.toContain("Arrival");
  });

  it("does not recommend neighbours of a disliked title", async () => {
    expect(titles(await recommend(user, { kind: "movie" }))).not.toContain("Comedy Sequel");
  });

  it("ranks a well-rated title supported by several liked seeds above a barely-voted one", async () => {
    const t = titles(await recommend(user, { kind: "movie" }));
    expect(t.indexOf("Moon")).toBeGreaterThanOrEqual(0);
    expect(t.indexOf("Moon")).toBeLessThan(t.indexOf("Obscure SF"));
  });

  it("drops a title the user dismissed", async () => {
    await dismiss(user, "movie", 10);
    expect(titles(await recommend(user, { kind: "movie" }))).not.toContain("Aliens");
  });

  it("does not call TMDB again for seeds whose links are already known", async () => {
    await recommend(user, { kind: "movie" });
    expect(tmdb.fetchRecommendations).not.toHaveBeenCalled();
  });
});

describe("recommend with a notoriety profile", () => {
  it("prefers a title as well known as the user's favourites over a better-rated, better-linked obscure one", async () => {
    await resetDb();
    const u = await createUser("cinephile");
    // Ses films aimés ont ~20 000 votes.
    for (let i = 1; i <= 6; i++) {
      await createMovie(100 + i, { title: `Classic ${i}`, genreIds: [SCIFI] });
      await db.execute(sql`UPDATE movies SET vote_count = 20000, vote_average = 8 WHERE id = ${100 + i}`);
      await setMovieRating(u, 100 + i, 9);
    }
    // Sans profil de notoriété, l'obscur gagnerait : mieux noté et nettement mieux relié.
    await summary(200, "Obscure but close", [SCIFI], 9.5, 40);
    await summary(201, "Known and close", [SCIFI], 7.5, 15000);
    for (let i = 1; i <= 6; i++) {
      await link(100 + i, 200, 1.0);
      await link(100 + i, 201, 0.6);
    }
    const t = titles(await recommend(u, { kind: "movie", limit: 10 }));
    expect(t.indexOf("Known and close")).toBeLessThan(t.indexOf("Obscure but close"));
  });
});

describe("buildCollabLinks", () => {
  it("links titles that the same users liked, with a cosine score", async () => {
    await createMovie(20, { title: "Shared A" });
    await createMovie(21, { title: "Shared B" });
    await createMovie(22, { title: "Lonely" });
    for (const name of ["u1", "u2", "u3"]) {
      const u = await createUser(name);
      await markMovieWatched(u, 20);
      await markMovieWatched(u, 21);
    }
    const loner = await createUser("u4");
    await markMovieWatched(loner, 22);

    await buildCollabLinks(3);

    const links = await db.execute<{ src_id: number; dst_id: number; score: number }>(sql`
      SELECT src_id, dst_id, score FROM item_links WHERE source = ${LinkSource.collab} ORDER BY src_id`);
    expect([...links]).toEqual([
      { src_id: 20, dst_id: 21, score: 1 },
      { src_id: 21, dst_id: 20, score: 1 },
    ]);
  });
});
