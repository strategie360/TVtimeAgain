/**
 * npm run recs:eval — mesure la qualité des recommandations sur le jeu --bench.
 * Les users du bench appartiennent à des « familles de goûts » (60 séries chacune).
 * Bonne recommandation = série de sa famille qu'il n'a pas encore vue.
 * Comparé au hasard : 60/3000 = 2 % de chances.
 */
import { sql } from "drizzle-orm";
import { closeDb, db } from "../src/db";
import { recommend } from "../src/lib/recs";

const BASE = 900_100_001;
const N = Number(process.argv[2] ?? 200);

(async () => {
  const users = await db.execute<{ id: number }>(sql`
    SELECT id FROM users WHERE email LIKE 'bench%' ORDER BY hashint4(id) LIMIT ${N}`);
  let hits = 0;
  let total = 0;
  const times: number[] = [];
  for (const u of users) {
    const lo = ((u.id % 100) * 30) % 3000;
    const t0 = performance.now();
    const recs = await recommend(u.id, { kind: "show", limit: 10 });
    times.push(performance.now() - t0);
    total += recs.length;
    hits += recs.filter((r) => (r.id - BASE - lo + 3000) % 3000 < 60).length;
  }
  times.sort((a, b) => a - b);
  console.log(`${users.length} users · précision@10 = ${((hits / Math.max(1, total)) * 100).toFixed(1)} % (hasard : 2 %)`);
  console.log(`latence : médiane ${times[times.length >> 1].toFixed(1)} ms · p95 ${times[Math.floor(times.length * 0.95)].toFixed(1)} ms`);
  await closeDb();
})();
