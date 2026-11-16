import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { db } from "@/db";

it("connects to the migrated test database", async () => {
  const [r] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'next_episode_id'`);
  expect(r.n).toBe(1);
});
