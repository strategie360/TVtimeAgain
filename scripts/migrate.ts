// npm run db:migrate:deploy — applique les migrations de drizzle/ avant le build Vercel
// (script "vercel-build"). Voir planMigration() pour les cas où rien n'est fait.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { planMigration } from "../src/lib/deploy";

const plan = planMigration(process.env);

if (!plan.run) {
  if (plan.fatal) {
    console.error(`échec : ${plan.reason}`);
    process.exitCode = 1;
  } else console.log(`migrations ignorées : ${plan.reason}`);
} else {
  const client = postgres(plan.url, { max: 1, onnotice: () => {} });
  migrate(drizzle(client), { migrationsFolder: "drizzle" })
    .then(() => console.log("migrations appliquées"))
    .catch((e) => {
      console.error("échec des migrations :", e instanceof Error ? e.message : e);
      process.exitCode = 1; // fait échouer le build : on ne déploie pas un code plus récent que la base
    })
    .finally(() => client.end());
}
