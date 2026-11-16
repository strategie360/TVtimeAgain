import { describe, expect, it } from "vitest";
import { notorietyFit, notorietyProfile } from "@/lib/recs";

const seed = (w: number, votes: number | null) => ({ w, vote_count: votes });

describe("notorietyProfile", () => {
  it("averages log10(votes) of liked titles, weighted by how much they were liked", () => {
    const p = notorietyProfile([seed(1, 9999), seed(1, 9999), seed(1, 9999), seed(1, 9999), seed(1, 9999)]);
    expect(p?.mean).toBeCloseTo(4, 5);
    expect(p?.sigma).toBe(0.35); // dispersion minimale
  });

  it("ignores disliked titles and titles without vote data", () => {
    const liked = [1, 2, 3, 4, 5].map(() => seed(0.8, 999));
    const p = notorietyProfile([...liked, seed(-1, 1_000_000), seed(1, null)]);
    expect(p?.mean).toBeCloseTo(3, 5);
  });

  it("returns null when there is too little history", () => {
    expect(notorietyProfile([seed(1, 1000), seed(1, 2000)])).toBeNull();
  });
});

describe("notorietyFit", () => {
  const profile = { mean: 4, sigma: 0.5 }; // aime des titres autour de 10 000 votes

  it("never penalises a title better known than usual", () => {
    expect(notorietyFit(9999, profile)).toBe(1);
    expect(notorietyFit(2_000_000, profile)).toBe(1);
  });

  it("penalises titles much more obscure than usual", () => {
    expect(notorietyFit(999, profile)).toBeCloseTo(Math.exp(-2), 5); // 2 écarts sous la moyenne
    expect(notorietyFit(10, profile)).toBeLessThan(0.001);
  });

  it("is neutral without a profile", () => {
    expect(notorietyFit(5, null)).toBe(1);
  });
});
