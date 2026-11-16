/**
 * npm run recs:holdout -- <dossier d'export Letterboxd> [--k 50] [--share 0.2] [--seed 1] [--tuning '{"maxSeeds":200}' ...]
 *
 * Mesure hors ligne de « Pour toi » sur un vrai historique, en BASE LOCALE uniquement :
 *  1. importe l'export dans un compte de test (même code que l'import de l'app) ;
 *  2. cache une part des films les mieux notés (note ≥ 8/10), au hasard mais de façon reproductible ;
 *  3. demande `k` recommandations de films et compte combien de films cachés sont retrouvés (rappel@k) ;
 *  4. supprime le compte de test.
 * Indique aussi la part de blockbusters proposés : un bon rappel obtenu en ne proposant que des
 * films très connus serait trompeur.
 *
 * Les données personnelles de l'export ne sont jamais écrites dans le dépôt ni affichées en entier.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { sql } from "drizzle-orm";
import { closeDb, db } from "../src/db";
import { createImport, processImport } from "../src/lib/imports";
import { collectFiles, mergeLetterboxd } from "../src/lib/letterboxd";
import { DEFAULT_TUNING, ensureLinks, notorietyFit, notorietyProfile, recommend, type Tuning } from "../src/lib/recs";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const opt = (name: string, def: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const K = opt("k", 50);
const SHARE = opt("share", 0.2);
const SEED = opt("seed", 1);
// Chaque --tuning ajoute un réglage à comparer ; le réglage par défaut est toujours mesuré en premier.
const tunings: Partial<Tuning>[] = [{}];
args.forEach((a, i) => {
  if (a === "--tuning") tunings.push(JSON.parse(args[i + 1]));
});

if (!dir) {
  console.error("usage : npm run recs:holdout -- <dossier d'export Letterboxd> [--k 50] [--share 0.2] [--seed 1]");
  process.exit(2);
}
if (/neon\.tech|vercel/i.test(process.env.DATABASE_URL ?? "")) {
  console.error("Refus : ce script écrit dans la base. Il ne tourne que sur une base locale.");
  process.exit(2);
}

function walk(root: string): string[] {
  return readdirSync(root).flatMap((f) => {
    const p = join(root, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Mélange reproductible (générateur congruentiel). */
function shuffle<T>(items: T[], seed: number) {
  const a = [...items];
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]).catch(() => {});
  }));
}

(async () => {
  const entries = walk(dir).map((p) => ({ path: relative(dir, p), text: readFileSync(p, "utf8") }));
  const rows = mergeLetterboxd(collectFiles(entries));
  const [u] = await db.execute<{ id: number }>(sql`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${`holdout-${Date.now()}@example.test`}, 'x', 'holdout') RETURNING id`);
  const userId = u.id;
  try {
    console.time("import");
    await processImport(await createImport(userId, "letterboxd", rows));
    console.timeEnd("import");

    const liked = await db.execute<{ movie_id: number }>(sql`
      SELECT movie_id FROM user_movies WHERE user_id = ${userId} AND status = 1 AND rating >= 8 ORDER BY movie_id`);
    const hidden = shuffle(liked.map((r) => r.movie_id), SEED).slice(0, Math.max(10, Math.round(liked.length * SHARE)));
    await db.execute(sql`DELETE FROM user_movies WHERE user_id = ${userId} AND movie_id = ANY(${`{${hidden.join(",")}}`}::int[])`);

    // Liens TMDB de toutes les graines (une seule fois pour tout le monde, comme en production à terme).
    console.time("liens");
    const seeds = await db.execute<{ movie_id: number }>(sql`SELECT movie_id FROM user_movies WHERE user_id = ${userId}`);
    await pool(seeds.map((s) => s.movie_id), 8, (id) => ensureLinks(0, id));
    console.timeEnd("liens");

    const hiddenSet = new Set(hidden);
    const [reach] = await db.execute<{ n: number; pool: number }>(sql`
      SELECT count(DISTINCT l.dst_id) FILTER (WHERE l.dst_id = ANY(${`{${hidden.join(",")}}`}::int[]))::int AS n,
             count(DISTINCT l.dst_id)::int AS pool
      FROM user_movies um JOIN item_links l ON l.src_kind = 0 AND l.src_id = um.movie_id AND l.dst_kind = 0
      WHERE um.user_id = ${userId}`);
    console.log(`historique : ${rows.length} lignes, ${liked.length} films notés ≥ 8, ${hidden.length} cachés ;` +
      ` ${reach.n} cachés atteignables parmi ${reach.pool} candidats possibles`);
    if (args.includes("--analyse")) await analyseSignals(userId, hiddenSet);
    console.log(`\nrappel@${K} | retrouvés | votes médians | blockbusters | réglage`);

    for (const tuning of tunings) {
      const t0 = performance.now();
      const recs = await recommend(userId, { kind: "movie", limit: K, tuning });
      const ms = performance.now() - t0;
      const hits = recs.filter((r) => hiddenSet.has(r.id)).length;
      const votes = recs.length
        ? await db.execute<{ vote_count: number }>(sql`
            SELECT vote_count FROM media_summary WHERE kind = 0 AND id = ANY(${`{${recs.map((r) => r.id).join(",")}}`}::int[])`)
        : [];
      const sorted = votes.map((v) => v.vote_count).sort((a, b) => a - b);
      const blockbusters = sorted.filter((v) => v >= 10000).length / Math.max(1, recs.length);
      const label = Object.keys(tuning).length ? JSON.stringify(tuning) : `défaut ${JSON.stringify(DEFAULT_TUNING)}`;
      console.log(`${(hits / hidden.length).toFixed(3).padStart(9)} | ${String(hits).padStart(9)} | ${String(sorted[sorted.length >> 1] ?? 0).padStart(13)} | ${blockbusters.toFixed(2).padStart(12)} | ${label} (${ms.toFixed(0)} ms)`);
    }
  } finally {
    await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    await closeDb();
  }
})();

/** AUC : probabilité qu'un film caché ait une valeur plus haute qu'un autre candidat (0,5 = signal inutile). */
function auc(values: number[], labels: boolean[]) {
  // Une valeur invalide (NaN) compte comme la plus basse : sinon le regroupement des égalités (===) ne finit jamais.
  const idx = values.map((v, i) => [Number.isFinite(v) ? v : -Infinity, labels[i]] as const).sort((a, b) => a[0] - b[0]);
  let rankSum = 0;
  let pos = 0;
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const avgRank = (i + j + 1) / 2; // rangs à égalité
    for (let k = i; k < j; k++) if (idx[k][1]) { rankSum += avgRank; pos++; }
    i = j;
  }
  const neg = idx.length - pos;
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : 0.5;
}

/** Quels signaux distinguent les films cachés parmi tous les candidats atteignables ? */
async function analyseSignals(userId: number, hidden: Set<number>) {
  const rows = await db.execute<{
    id: number; cf_all: number; cf_pos: number; support: number; max_link: number;
    vote_average: number; vote_count: number; popularity: number; year: number | null;
  }>(sql`
    WITH seeds AS (
      SELECT movie_id AS id,
        (CASE WHEN status = 0 THEN 0.25 WHEN rating IS NULL THEN 0.6 ELSE (rating - 5.5) / 4.5 END)::real AS w
      FROM user_movies WHERE user_id = ${userId}
    )
    SELECT l.dst_id AS id,
      sum(s.w * l.score)::real AS cf_all,
      sum(greatest(s.w, 0) * l.score)::real AS cf_pos,
      count(*) FILTER (WHERE s.w > 0)::int AS support,
      max(l.score)::real AS max_link,
      ms.vote_average, ms.vote_count, ms.popularity, ms.year
    FROM seeds s JOIN item_links l ON l.src_kind = 0 AND l.src_id = s.id AND l.dst_kind = 0
    JOIN media_summary ms ON ms.kind = 0 AND ms.id = l.dst_id
    WHERE NOT EXISTS (SELECT 1 FROM user_movies um WHERE um.user_id = ${userId} AND um.movie_id = l.dst_id)
    GROUP BY l.dst_id, ms.vote_average, ms.vote_count, ms.popularity, ms.year`);
  const labels = rows.map((r) => hidden.has(r.id));
  const seedRows = await db.execute<{ w: number; vote_count: number | null }>(sql`
    SELECT (CASE WHEN um.status = 0 THEN 0.25 WHEN um.rating IS NULL THEN 0.6 ELSE (um.rating - 5.5) / 4.5 END)::real AS w, m.vote_count
    FROM user_movies um JOIN movies m ON m.id = um.movie_id WHERE um.user_id = ${userId}`);
  const prof = notorietyProfile([...seedRows]);
  const twoSided = (v: number) => {
    if (!prof) return 1;
    const z = (Math.log10(v + 1) - prof.mean) / prof.sigma;
    return Math.exp(-0.5 * z * z);
  };
  console.log(`profil de notoriété : moyenne ${prof?.mean.toFixed(2)} (≈ ${prof ? Math.round(10 ** prof.mean) : "?"} votes), écart ${prof?.sigma.toFixed(2)}`);
  const bayes = (r: (typeof rows)[number]) => (r.vote_count * r.vote_average + 300 * 6.8) / (r.vote_count + 300);
  const signals: [string, (r: (typeof rows)[number]) => number][] = [
    ["score CF actuel (somme pondérée)", (r) => r.cf_all],
    ["CF films aimés seulement", (r) => r.cf_pos],
    ["nb de films aimés qui y mènent", (r) => r.support],
    ["meilleur lien unique", (r) => r.max_link],
    ["note TMDB brute", (r) => r.vote_average],
    ["note TMDB bayésienne", bayes],
    ["log(nb de votes)", (r) => Math.log10(r.vote_count + 1)],
    ["popularité TMDB", (r) => r.popularity],
    ["ancienneté (année)", (r) => -(r.year ?? 2100)],
    ["support × note bayésienne", (r) => r.support * bayes(r)],
    ["CF aimés × note bayésienne", (r) => r.cf_pos * bayes(r)],
    ["CF aimés × (note bayésienne − 6)²", (r) => r.cf_pos * Math.max(0, bayes(r) - 6) ** 2],
    ["notoriété : cloche (deux côtés)", (r) => twoSided(r.vote_count)],
    ["notoriété : sens unique", (r) => notorietyFit(r.vote_count, prof)],
    ["CF aimés × cloche", (r) => r.cf_pos * twoSided(r.vote_count)],
    ["CF aimés × sens unique", (r) => r.cf_pos * notorietyFit(r.vote_count, prof)],
    ["CF aimés × log(votes)", (r) => r.cf_pos * Math.log10(r.vote_count + 1)],
    ["CF aimés × log(votes)²", (r) => r.cf_pos * Math.log10(r.vote_count + 1) ** 2],
    ["CF aimés × sens unique × note bayésienne", (r) => r.cf_pos * notorietyFit(r.vote_count, prof) * bayes(r)],
  ];
  console.log(`\nAUC sur ${rows.length} candidats (${labels.filter(Boolean).length} cachés atteignables) :`);
  for (const [name, f] of signals) console.log(`  ${auc(rows.map(f), labels).toFixed(3)}  ${name}`);
}
