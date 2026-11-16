import { afterEach, describe, expect, it, vi } from "vitest";

describe("db module", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("can be imported without DATABASE_URL (next build), and fails clearly on first use", async () => {
    vi.resetModules();
    const saved = (globalThis as { __pg?: unknown }).__pg;
    (globalThis as { __pg?: unknown }).__pg = undefined; // forcer une nouvelle connexion
    vi.stubEnv("DATABASE_URL", "");
    try {
      const mod = await import("@/db"); // ne doit pas lever d'erreur
      expect(() => mod.db.select).toThrow("DATABASE_URL manquant");
    } finally {
      (globalThis as { __pg?: unknown }).__pg = saved;
    }
  });
});
