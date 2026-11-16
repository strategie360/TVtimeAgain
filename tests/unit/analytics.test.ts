import { describe, expect, it } from "vitest";
import { stripQuery } from "@/lib/analytics";

describe("stripQuery", () => {
  it("keeps only the page path, without search terms or other parameters", () => {
    expect(stripQuery("https://t-vtime-again.vercel.app/search?q=severance")).toBe("https://t-vtime-again.vercel.app/search");
    expect(stripQuery("https://t-vtime-again.vercel.app/login?deleted=1")).toBe("https://t-vtime-again.vercel.app/login");
  });

  it("drops the hash and leaves clean URLs untouched", () => {
    expect(stripQuery("https://example.test/show/1396#saison-2")).toBe("https://example.test/show/1396");
    expect(stripQuery("https://example.test/stats")).toBe("https://example.test/stats");
  });

  it("handles relative URLs", () => {
    expect(stripQuery("/search?q=dune#top")).toBe("/search");
  });
});
