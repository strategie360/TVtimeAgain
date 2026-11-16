import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { deleteAccount, exportUserData } from "@/lib/account";
import { createImport } from "@/lib/imports";
import { dismiss } from "@/lib/recs";
import { markEpisodes, markMovieWatched, setMovieRating, setShowFlags } from "@/lib/tracking";
import { airedSeasons, createMovie, createShow, createUser, resetDb } from "../helpers/db";

const USER_TABLES = ["sessions", "user_shows", "watched_episodes", "user_movies", "user_feedback", "imports"];

async function rowsFor(table: string, userId: number) {
  const [r] = await db.execute<{ n: number }>(sql.raw(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = ${userId}`));
  return r.n;
}

let alice: number;
let bob: number;

beforeEach(async () => {
  await resetDb();
  alice = await createUser("alice");
  bob = await createUser("bob");
  await createShow({ id: 1, name: "Severance", episodes: airedSeasons(1, 3) });
  await createMovie(10, { title: "Heat" });
  await createMovie(11, { title: "Alien" });

  await markEpisodes(alice, 1, { episodeIds: [1101, 1102] });
  await setShowFlags(alice, 1, { favorite: true, rating: 9 });
  await markMovieWatched(alice, 10);
  await setMovieRating(alice, 10, 8);
  await dismiss(alice, "movie", 999);
  await createImport(alice, "letterboxd", [{ name: "Heat", year: 1995, watched: true, watchedAt: null, rating: null, plays: 1 }]);
  await db.execute(sql`INSERT INTO sessions (id, user_id, expires_at) VALUES ('s-alice', ${alice}, now() + interval '1 day')`);

  await markMovieWatched(bob, 11);
});

describe("exportUserData", () => {
  it("exports the account, shows with watched episodes, movies and dismissed recommendations", async () => {
    const data = await exportUserData(alice);
    expect(data?.account).toMatchObject({ email: "alice@example.test", displayName: "alice" });
    expect(data?.shows).toEqual([
      expect.objectContaining({
        tmdbId: 1,
        name: "Severance",
        status: "en cours",
        favorite: true,
        rating: 9,
        watchedEpisodes: [expect.objectContaining({ season: 1, number: 1, plays: 1 }), expect.objectContaining({ season: 1, number: 2 })],
      }),
    ]);
    expect(data?.movies).toEqual([expect.objectContaining({ tmdbId: 10, title: "Heat", status: "vu", rating: 8, plays: 1 })]);
    expect(data?.dismissedRecommendations).toEqual([expect.objectContaining({ kind: "movie", tmdbId: 999 })]);
  });

  it("never includes another user's data and never includes the password hash", async () => {
    const json = JSON.stringify(await exportUserData(alice));
    expect(json).not.toContain("Alien");
    expect(json).not.toContain("bob");
    expect(json).not.toMatch(/password|scrypt/i);
  });

  it("returns null for an unknown user", async () => {
    expect(await exportUserData(123456)).toBeNull();
  });
});

describe("deleteAccount", () => {
  it("removes the user and every row that belongs to them", async () => {
    expect(await deleteAccount(alice)).toBe(true);
    const [u] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM users WHERE id = ${alice}`);
    expect(u.n).toBe(0);
    for (const t of USER_TABLES) expect(await rowsFor(t, alice), t).toBe(0);
    const [items] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM import_items`);
    expect(items.n).toBe(0);
  });

  it("keeps other users and the shared catalog intact", async () => {
    await deleteAccount(alice);
    expect(await rowsFor("user_movies", bob)).toBe(1);
    const [c] = await db.execute<{ shows: number; movies: number }>(sql`
      SELECT (SELECT count(*)::int FROM shows) AS shows, (SELECT count(*)::int FROM movies) AS movies`);
    expect(c).toEqual({ shows: 1, movies: 2 });
  });

  it("reports false when the account does not exist", async () => {
    expect(await deleteAccount(123456)).toBe(false);
  });
});
