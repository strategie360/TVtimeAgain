import { describe, expect, it } from "vitest";
import { isAuthorizedCron, planMigration } from "@/lib/deploy";

describe("isAuthorizedCron", () => {
  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCron("Bearer s3cret", "s3cret")).toBe(true);
  });

  it.each([
    ["a wrong secret", "Bearer nope", "s3cret"],
    ["a secret of another length", "Bearer s3cret-but-longer", "s3cret"],
    ["no Bearer prefix", "s3cret", "s3cret"],
    ["no header", null, "s3cret"],
    ["no secret configured, even with an empty bearer", "Bearer ", undefined],
    ["an empty configured secret", "Bearer ", ""],
  ])("rejects %s", (_label, header, secret) => {
    expect(isAuthorizedCron(header, secret)).toBe(false);
  });

  it("does not throw on multi-byte characters of the same string length", () => {
    expect(isAuthorizedCron("Bearer éé", "ab")).toBe(false);
  });
});

describe("planMigration", () => {
  it("runs on Vercel production with the direct (unpooled) Neon URL", () => {
    expect(planMigration({ VERCEL_ENV: "production", DATABASE_URL: "pooled", DATABASE_URL_UNPOOLED: "direct" })).toEqual({
      run: true,
      url: "direct",
    });
  });

  it("falls back to DATABASE_URL when there is no unpooled URL", () => {
    expect(planMigration({ DATABASE_URL: "postgres://local" })).toEqual({ run: true, url: "postgres://local" });
  });

  it("never touches the database from a feature-branch preview, and lets the preview build continue", () => {
    expect(planMigration({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/x", DATABASE_URL: "dev-db" })).toMatchObject({
      run: false,
      fatal: false,
    });
  });

  it("migrates the staging database on the dev branch preview", () => {
    expect(
      planMigration({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev", DATABASE_URL: "pooled", DATABASE_URL_UNPOOLED: "dev-direct" }),
    ).toEqual({ run: true, url: "dev-direct" });
  });

  it("fails the dev branch build when its staging database is not configured", () => {
    expect(planMigration({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev" })).toMatchObject({ run: false, fatal: true });
  });

  it("fails a production build that has no database URL", () => {
    expect(planMigration({ VERCEL_ENV: "production" })).toMatchObject({ run: false, fatal: true });
  });

  it("only skips (no failure) outside Vercel when no URL is set", () => {
    expect(planMigration({})).toMatchObject({ run: false, fatal: false });
  });
});
