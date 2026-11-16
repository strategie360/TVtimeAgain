import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant (voir .env.example)");

// Un seul pool par process (le hot-reload de Next recrée les modules en dev).
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
export const pg =
  g.__pg ??
  postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    // Requêtes préparées : le plan est mis en cache côté Postgres.
    // Mettre prepare:false derrière PgBouncer en mode transaction.
    prepare: process.env.DATABASE_PREPARE !== "false",
  });
if (process.env.NODE_ENV !== "production") g.__pg = pg;

export const db = drizzle(pg, { schema });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Db = typeof db | Tx;
