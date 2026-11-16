import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { Kind, LinkSource } from "@/db/schema";
import { recommendRows } from "@/lib/recs";
import { setMovieRating } from "@/lib/tracking";
import { createMovie, createUser, resetDb } from "../helpers/db";

// Aucun appel réseau : tout ce que l'algorithme lirait chez TMDB est déjà en base.
vi.mock("@/lib/tmdb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb")>()),
  tmdb: vi.fn(async () => {
    throw new Error("pas d'appel TMDB dans ce test");
  }),
  fetchRecommendations: vi.fn(async () => []),
  fetchList: vi.fn(async () => ({ results: [], total_pages: 1 })),
  discoverByGenres: vi.fn(async () => ({ results: [], total_pages: 1 })),
}));

const DRAMA = 18;
const VILLENEUVE = 137427;

async function summary(id: number, title: string, votes: number, average = 7.8) {
  await db.execute(sql`
    INSERT INTO media_summary (kind, id, title, year, genre_ids, vote_average, vote_count)
    VALUES (${Kind.movie}, ${id}, ${title}, 2010, ${`{${DRAMA}}`}::smallint[], ${average}, ${votes})
    ON CONFLICT (kind, id) DO NOTHING`);
}
async function link(src: number, dst: number, score: number) {
  await db.execute(sql`
    INSERT INTO item_links (src_kind, src_id, source, dst_kind, dst_id, score)
    VALUES (${Kind.movie}, ${src}, ${LinkSource.tmdb}, ${Kind.movie}, ${dst}, ${score})`);
  await db.execute(sql`INSERT INTO link_fetches (kind, id) VALUES (${Kind.movie}, ${src}) ON CONFLICT DO NOTHING`);
}
async function directedBy(movieId: number, personId: number) {
  await db.execute(sql`
    INSERT INTO media_features (kind, id, directors) VALUES (${Kind.movie}, ${movieId}, ${`{${personId}}`}::int[])
    ON CONFLICT (kind, id) DO UPDATE SET directors = excluded.directors`);
}

let user: number;

beforeEach(async () => {
  await resetDb();
  user = await createUser();
  await db.execute(sql`INSERT INTO people (id, name, credits_fetched_at) VALUES (${VILLENEUVE}, 'Denis Villeneuve', now())`);
  // Trois films aimés de Villeneuve (votes connus : profil de notoriété autour de 5 000).
  for (const [id, title] of [[1, "Arrival"], [2, "Sicario"], [3, "Prisoners"]] as const) {
    await createMovie(id, { title, genreIds: [DRAMA] });
    await db.execute(sql`UPDATE movies SET vote_count = 5000, vote_average = 8 WHERE id = ${id}`);
    await setMovieRating(user, id, 9);
    await directedBy(id, VILLENEUVE);
  }
  // Ses autres films : 4 longs-métrages connus et un court-métrage presque sans votes.
  for (const [id, title, votes] of [[10, "Incendies", 3000], [11, "Enemy", 4000], [12, "Polytechnique", 900], [13, "Maelström", 400], [14, "Next Floor", 60]] as const) {
    await summary(id, title, votes);
    await db.execute(sql`INSERT INTO director_credits (person_id, movie_id) VALUES (${VILLENEUVE}, ${id})`);
  }
  // Voisins de graphe : 12 titres, assez pour remplir « Pour toi » et une rangée « Parce que tu as aimé ».
  for (let i = 0; i < 20; i++) {
    await summary(100 + i, `Neighbour ${i}`, 5000 - i * 10);
    await link(1, 100 + i, 1 - i * 0.03);
    await link(2, 100 + i, 0.8 - i * 0.03);
  }
});

describe("recommendRows", () => {
  it("starts with the main selection and never repeats a title across rows", async () => {
    const rows = await recommendRows(user, { kind: "movie" });
    expect(rows[0].id).toBe("for-you");
    const keys = rows.flatMap((r) => r.items.map((i) => `${i.kind}:${i.id}`));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("adds a director row for a director with several liked films, without shorts", async () => {
    const rows = await recommendRows(user, { kind: "movie" });
    const row = rows.find((r) => r.id === `director-${VILLENEUVE}`);
    expect(row?.title).toBe("De Denis Villeneuve");
    expect(row?.subtitle).toBe("Tu as aimé 3 de ses films");
    // Même note TMDB : le plus voté (note la plus fiable) d'abord ; le court-métrage (60 votes) est écarté.
    expect(row?.items.map((i) => i.title)).toEqual(["Enemy", "Incendies", "Polytechnique", "Maelström"]);
  });

  it("drops a director row that would be too short", async () => {
    await db.execute(sql`DELETE FROM director_credits WHERE movie_id IN (11, 12, 13)`);
    const rows = await recommendRows(user, { kind: "movie" });
    expect(rows.some((r) => r.id.startsWith("director-"))).toBe(false);
  });

  it("does not make any TMDB call when everything is already known", async () => {
    const { tmdb } = await import("@/lib/tmdb");
    await recommendRows(user, { kind: "movie" });
    expect(tmdb).not.toHaveBeenCalled();
  });
});
