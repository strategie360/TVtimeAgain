/**
 * Démarre un Postgres jetable pour la suite de tests, sans installation ni droits admin
 * (embedded-postgres), applique les migrations du projet, puis l'arrête à la fin.
 *
 * TEST_DATABASE_URL permet d'utiliser à la place une base existante (plus rapide en local).
 * ATTENTION : cette base est vidée par les tests.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

async function applyMigrations(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}

export default async function setup(project: TestProject) {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    await applyMigrations(external);
    project.provide("databaseUrl", external);
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "tvtime-test-pg-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    autoRehydrateSymlinks: true,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("tvtime_test");
  const url = `postgres://postgres:postgres@127.0.0.1:${port}/tvtime_test`;
  await applyMigrations(url);
  project.provide("databaseUrl", url);

  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
