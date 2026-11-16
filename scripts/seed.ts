/**
 * npm run seed            -> petit catalogue fictif pour développer sans clé TMDB
 * npm run seed -- --bench -> + volume réaliste (10k users, ~2M épisodes vus) pour
 *                            vérifier les plans de requêtes (EXPLAIN ANALYZE)
 *
 * Les IDs fictifs commencent à 900 000 000 pour ne jamais entrer en collision
 * avec de vrais IDs TMDB.
 */
import { sql } from "drizzle-orm";
import { db, pg } from "../src/db";

const BASE = 900_000_000;

async function seedDemo() {
  const today = new Date();
  const d = (offsetDays: number) => new Date(today.getTime() + offsetDays * 864e5).toISOString().slice(0, 10);

  // Série terminée : 2 saisons x 8 épisodes, finie il y a un an.
  // Série en cours : saison 1 diffusée, saison 2 en diffusion hebdo (passés + à venir).
  await db.execute(sql`
    INSERT INTO shows (id, name, overview, first_air_date, status, network, episode_runtime, season_count, synced_at)
    VALUES
      (${BASE + 1}, 'Les Archives du Phare', 'Une archiviste découvre des enregistrements impossibles.', ${d(-900)}, 'Ended', 'Canal Démo', 45, 2, now()),
      (${BASE + 2}, 'Orbite Basse', 'Six astronautes, une station, un secret.', ${d(-400)}, 'Returning Series', 'Démo+', 52, 2, now())
    ON CONFLICT (id) DO UPDATE SET synced_at = now()`);

  await db.execute(sql`
    INSERT INTO episodes (id, show_id, season, number, name, air_date, runtime)
    SELECT ${BASE} + 1000 + s * 100 + n, ${BASE + 1}, s, n, 'Chapitre ' || n,
           (${d(-900)}::date + ((s - 1) * 8 + n) * 7), 45
    FROM generate_series(1, 2) s, generate_series(1, 8) n
    ON CONFLICT (id) DO NOTHING`);
  await db.execute(sql`
    INSERT INTO episodes (id, show_id, season, number, name, air_date, runtime)
    SELECT ${BASE} + 2000 + s * 100 + n, ${BASE + 2}, s, n, 'Épisode ' || n,
           CASE WHEN s = 1 THEN ${d(-400)}::date + n * 7 ELSE ${d(-21)}::date + (n - 1) * 7 END, 52
    FROM generate_series(1, 2) s, generate_series(1, 10) n
    ON CONFLICT (id) DO NOTHING`);
  // Un épisode spécial (saison 0).
  await db.execute(sql`
    INSERT INTO episodes (id, show_id, season, number, name, air_date, runtime)
    VALUES (${BASE + 2999}, ${BASE + 2}, 0, 1, 'Making-of', ${d(-100)}, 30) ON CONFLICT DO NOTHING`);
  await db.execute(sql`UPDATE shows SET aired_episodes = aired_episode_count(id) WHERE id IN (${BASE + 1}, ${BASE + 2})`);

  await db.execute(sql`
    INSERT INTO movies (id, title, overview, release_date, runtime, synced_at) VALUES
      (${BASE + 1}, 'Le Dernier Train', 'Un huis clos ferroviaire.', ${d(-300)}, 118, now()),
      (${BASE + 2}, 'Sable Noir', 'Western spatial.', ${d(-50)}, 134, now())
    ON CONFLICT (id) DO UPDATE SET synced_at = now()`);
  console.log("Démo : 2 séries (ids", BASE + 1, BASE + 2, "), 2 films.");
}

async function seedBench() {
  console.time("bench");
  const SHOWS = 3000;
  const USERS = 10_000;
  // 3000 séries x 5 saisons x 12 épisodes = 180k épisodes
  await db.execute(sql`
    INSERT INTO shows (id, name, status, episode_runtime, season_count, synced_at)
    SELECT ${BASE} + 100000 + i, 'Bench show ' || i, CASE WHEN i % 3 = 0 THEN 'Ended' ELSE 'Returning Series' END, 40, 5, now()
    FROM generate_series(1, ${SHOWS}) i ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO episodes (id, show_id, season, number, air_date, runtime)
    SELECT ${BASE} + 10000000 + i * 100 + s * 15 + n, ${BASE} + 100000 + i, s, n,
           current_date - (6 - s) * 120 + n * 7 - (i % 200), 40
    FROM generate_series(1, ${SHOWS}) i, generate_series(1, 5) s, generate_series(1, 12) n
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`UPDATE shows SET aired_episodes = aired_episode_count(id) WHERE id > ${BASE + 100000}`);

  await db.execute(sql`
    INSERT INTO users (email, password_hash, display_name)
    SELECT 'bench' || i || '@example.test', 'x', 'bench' || i FROM generate_series(1, ${USERS}) i
    ON CONFLICT DO NOTHING`);
  // Chaque user suit 20 séries : 15 dans sa « famille de goûts » (100 familles de
  // 60 séries, comme dans la vraie vie : les fans de SF regardent de la SF) et 5 au
  // hasard. Sans cette structure, le filtrage collaboratif n'aurait rien à apprendre.
  await db.execute(sql`
    INSERT INTO user_shows (user_id, show_id, status, last_watched_at)
    SELECT u.id,
      ${BASE} + 100000 + 1 + CASE WHEN k <= 15
        THEN ((u.id % 100) * 30 + (abs(hashint4(u.id * 31 + k)) % 60)) % ${SHOWS}
        ELSE abs(hashint4(u.id * 97 + k)) % ${SHOWS} END,
      0, now() - (k || ' days')::interval
    FROM users u, generate_series(1, 20) k WHERE u.email LIKE 'bench%'
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    INSERT INTO watched_episodes (user_id, show_id, episode_id, watched_at)
    SELECT us.user_id, us.show_id, e.id, now() - ((e.id % 300) || ' days')::interval
    FROM user_shows us
    JOIN users u ON u.id = us.user_id AND u.email LIKE 'bench%'
    JOIN episodes e ON e.show_id = us.show_id AND e.season = 1 + (us.user_id % 2) AND e.air_date <= current_date
    ON CONFLICT DO NOTHING`);
  await db.execute(sql`
    UPDATE user_shows us SET watched_count = c.n, next_episode_id = next_episode_id(us.user_id, us.show_id)
    FROM (SELECT user_id, show_id, count(*) n FROM watched_episodes GROUP BY 1, 2) c
    WHERE c.user_id = us.user_id AND c.show_id = us.show_id`);
  await db.execute(sql`ANALYZE`);
  const [c] = await db.execute<{ n: number }>(sql`SELECT count(*)::int n FROM watched_episodes`);
  console.timeEnd("bench");
  console.log("watched_episodes :", c.n, "lignes");
}

(async () => {
  await seedDemo();
  if (process.argv.includes("--bench")) await seedBench();
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pg.end());
