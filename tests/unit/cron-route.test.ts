import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sync from "@/lib/sync";
import { GET, POST } from "@/app/api/v1/cron/sync/route";

vi.mock("@/lib/sync", () => ({ runDailySync: vi.fn(async () => ({ ok: "synced" })) }));

const call = (handler: typeof GET, method: string, authorization?: string) =>
  handler(
    new NextRequest("http://localhost/api/v1/cron/sync", {
      method,
      headers: authorization ? { authorization } : {},
    }),
    { params: Promise.resolve({}) },
  );

describe("cron sync route", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.mocked(sync.runDailySync).mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("runs the daily job for a Vercel Cron GET with the secret", async () => {
    const res = await call(GET, "GET", "Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: "synced" });
    expect(sync.runDailySync).toHaveBeenCalledOnce();
  });

  it("also accepts a manual POST with the secret", async () => {
    expect((await call(POST, "POST", "Bearer s3cret")).status).toBe(200);
  });

  it("refuses calls without the right secret and does not run the job", async () => {
    expect((await call(GET, "GET")).status).toBe(401);
    expect((await call(GET, "GET", "Bearer wrong")).status).toBe(401);
    expect(sync.runDailySync).not.toHaveBeenCalled();
  });
});
