import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { ShowStatus } from "@/db/schema";
import {
  followShow,
  markEpisodes,
  markMovieWatched,
  markMoviesWatchedBatch,
  setMovieRating,
  unfollowShow,
  unmarkEpisodes,
  unmarkMovie,
} from "@/lib/tracking";
import { airedSeasons, createMovie, createShow, createUser, epId, one, resetDb } from "../helpers/db";

const ENDED = 1; // 2 saisons × 4 épisodes de 40 min, terminée
const RETURNING = 2; // saison 1 diffusée, saison 2 : 2 diffusés + 2 à venir

type UserShow = { status: number; watched_count: number; next_episode_id: number | null };
type Counters = { episodes_watched: number; episode_minutes: number; movies_watched: number; movie_minutes: number };

const userShow = (u: number, s: number) =>
  one<UserShow>(sql`SELECT status, watched_count, next_episode_id FROM user_shows WHERE user_id = ${u} AND show_id = ${s}`);
const counters = (u: number) =>
  one<Counters>(sql`SELECT episodes_watched, episode_minutes, movies_watched, movie_minutes FROM users WHERE id = ${u}`);

let user: number;

beforeEach(async () => {
  await resetDb();
  user = await createUser();
  await createShow({ id: ENDED, status: "Ended", runtime: 40, episodes: airedSeasons(2, 4) });
  await createShow({
    id: RETURNING,
    runtime: 50,
    episodes: [
      ...airedSeasons(1, 3),
      { season: 2, number: 1, airOffsetDays: -14 },
      { season: 2, number: 2, airOffsetDays: -7, runtime: 60 },
      { season: 2, number: 3, airOffsetDays: 7 },
      { season: 2, number: 4, airOffsetDays: null },
      { season: 0, number: 1, airOffsetDays: -30 }, // épisode spécial
    ],
  });
});

describe("markEpisodes", () => {
  it("marks a whole season and updates progress, next episode and user counters", async () => {
    const r = await markEpisodes(user, ENDED, { season: 1 });
    expect(r).toEqual({ added: 4, minutes: 160, nextEpisodeId: epId(ENDED, 2, 1) });
    expect(await userShow(user, ENDED)).toEqual({ status: ShowStatus.watching, watched_count: 4, next_episode_id: epId(ENDED, 2, 1) });
    expect(await counters(user)).toMatchObject({ episodes_watched: 4, episode_minutes: 160 });
  });

  it("is idempotent: marking the same episodes again changes nothing", async () => {
    await markEpisodes(user, ENDED, { season: 1 });
    const again = await markEpisodes(user, ENDED, { season: 1 });
    expect(again.added).toBe(0);
    expect((await userShow(user, ENDED)).watched_count).toBe(4);
    expect((await counters(user)).episodes_watched).toBe(4);
  });

  it("refuses episodes that have not aired yet", async () => {
    const r = await markEpisodes(user, RETURNING, { episodeIds: [epId(RETURNING, 2, 3), epId(RETURNING, 2, 4)] });
    expect(r.added).toBe(0);
  });

  it("marks everything up to an episode, using each episode's own runtime when known", async () => {
    const r = await markEpisodes(user, RETURNING, { upToEpisodeId: epId(RETURNING, 2, 2) });
    expect(r.added).toBe(5); // S1E1-3 + S2E1-2, pas l'épisode spécial
    expect(r.minutes).toBe(4 * 50 + 60);
    expect(r.nextEpisodeId).toBe(epId(RETURNING, 2, 3)); // le prochain peut ne pas être encore diffusé
  });

  it("does not send the user back to an episode they skipped", async () => {
    await markEpisodes(user, ENDED, { episodeIds: [epId(ENDED, 1, 3)] });
    expect((await userShow(user, ENDED)).next_episode_id).toBe(epId(ENDED, 1, 4));
  });

  it("completes an ended show once everything is watched, and reopens it when an episode is unmarked", async () => {
    await markEpisodes(user, ENDED, { all: true });
    expect(await userShow(user, ENDED)).toMatchObject({ status: ShowStatus.completed, next_episode_id: null });

    await unmarkEpisodes(user, ENDED, { episodeIds: [epId(ENDED, 2, 4)] });
    expect(await userShow(user, ENDED)).toMatchObject({ status: ShowStatus.watching, next_episode_id: epId(ENDED, 2, 4), watched_count: 7 });
  });

  it("keeps a caught-up returning show in progress", async () => {
    await markEpisodes(user, RETURNING, { all: true });
    expect(await userShow(user, RETURNING)).toMatchObject({ status: ShowStatus.watching, next_episode_id: epId(RETURNING, 2, 3) });
  });
});

describe("unmarkEpisodes", () => {
  it("decrements progress and user counters", async () => {
    await markEpisodes(user, ENDED, { season: 1 });
    const r = await unmarkEpisodes(user, ENDED, { episodeIds: [epId(ENDED, 1, 4)] });
    expect(r.removed).toBe(1);
    expect((await userShow(user, ENDED)).watched_count).toBe(3);
    expect(await counters(user)).toMatchObject({ episodes_watched: 3, episode_minutes: 120 });
  });

  it("does nothing for episodes that were not watched", async () => {
    await markEpisodes(user, ENDED, { season: 1 });
    expect((await unmarkEpisodes(user, ENDED, { season: 2 })).removed).toBe(0);
    expect((await counters(user)).episodes_watched).toBe(4);
  });
});

describe("followShow / unfollowShow", () => {
  it("follows a show without watching it and points to the first episode", async () => {
    await followShow(user, ENDED);
    expect(await userShow(user, ENDED)).toEqual({ status: ShowStatus.planned, watched_count: 0, next_episode_id: epId(ENDED, 1, 1) });
  });

  it("unfollowing removes the history, including specials, and the counters", async () => {
    await markEpisodes(user, RETURNING, { all: true });
    await markEpisodes(user, RETURNING, { season: 0 });
    await unfollowShow(user, RETURNING);
    expect(await userShow(user, RETURNING)).toBeUndefined();
    expect(await counters(user)).toMatchObject({ episodes_watched: 0, episode_minutes: 0 });
  });
});

describe("movies", () => {
  beforeEach(async () => {
    await createMovie(10, { runtime: 120 });
    await createMovie(11, { runtime: 90 });
    await createMovie(12, { runtime: null });
  });

  it("counts a film once but adds every rewatch to the time watched", async () => {
    await markMovieWatched(user, 10);
    await markMovieWatched(user, 10);
    expect(await counters(user)).toMatchObject({ movies_watched: 1, movie_minutes: 240 });
    expect(await one(sql`SELECT plays FROM user_movies WHERE user_id = ${user} AND movie_id = 10`)).toEqual({ plays: 2 });
  });

  it("removing a film takes all its plays out of the counters", async () => {
    await markMovieWatched(user, 10);
    await markMovieWatched(user, 10);
    await unmarkMovie(user, 10);
    expect(await counters(user)).toMatchObject({ movies_watched: 0, movie_minutes: 0 });
  });

  it("rating a film marks it as watched", async () => {
    await setMovieRating(user, 11, 8);
    expect(await one(sql`SELECT status, rating FROM user_movies WHERE user_id = ${user} AND movie_id = 11`)).toEqual({ status: 1, rating: 8 });
    expect(await counters(user)).toMatchObject({ movies_watched: 1, movie_minutes: 90 });
  });

  it("marks a batch of films in one go, tolerating unknown runtimes and unknown ids", async () => {
    await markMovieWatched(user, 10);
    const added = await markMoviesWatchedBatch(user, [10, 11, 12, 999]);
    expect(added).toBe(3); // 999 n'existe pas dans le catalogue
    expect(await counters(user)).toMatchObject({ movies_watched: 3, movie_minutes: 210 });
  });
});
