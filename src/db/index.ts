import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Client = ReturnType<typeof postgres>;
type Database = ReturnType<typeof drizzle<typeof schema>>;

// Un seul pool par process (le hot-reload de Next recrée les modules en dev).
const g = globalThis as unknown as { __pg?: Client };

function client(): Client {
  if (g.__pg) return g.__pg;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant (voir .env.example)");
  g.__pg = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    // Requêtes préparées : le plan est mis en cache côté Postgres.
    // Mettre prepare:false derrière un pooler en mode transaction (PgBouncer, Neon).
    prepare: process.env.DATABASE_PREPARE !== "false",
  });
  return g.__pg;
}

/**
 * Créé à la première utilisation, pas au chargement du module : `next build` charge les routes
 * pour collecter leurs métadonnées, et doit pouvoir le faire sans base (déploiements de
 * prévisualisation). Sans DATABASE_URL, c'est la première requête qui échoue, avec un message clair.
 */
function lazy<T extends object>(create: () => T): T {
  let instance: T | undefined;
  return new Proxy({} as T, {
    get(_target, prop) {
      instance ??= create();
      const value = Reflect.get(instance, prop, instance);
      return typeof value === "function" ? value.bind(instance) : value;
    },
  });
}

export const db: Database = lazy(() => drizzle(client(), { schema }));

/** Ferme le pool (fin des scripts en ligne de commande). Sans effet s'il n'a jamais été ouvert. */
export async function closeDb() {
  const c = g.__pg;
  g.__pg = undefined;
  await c?.end();
}

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Db = Database | Tx;
