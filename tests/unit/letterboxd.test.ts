import { describe, expect, it } from "vitest";
import { collectFiles, detectFile, mergeLetterboxd, parseCsv } from "@/lib/letterboxd";

describe("parseCsv", () => {
  it("maps rows to the header columns", () => {
    expect(parseCsv("Name,Year\nHeat,1995\n")).toEqual([{ Name: "Heat", Year: "1995" }]);
  });

  it("handles quoted commas, escaped quotes and line breaks inside quotes", () => {
    const rows = parseCsv('Name,Year\n"The Good, the Bad and the Ugly",1966\n"Say ""hi""\nagain",2001\n');
    expect(rows.map((r) => r.Name)).toEqual(["The Good, the Bad and the Ugly", 'Say "hi"\nagain']);
  });

  it("ignores a UTF-8 BOM, CRLF line endings and blank lines", () => {
    expect(parseCsv("﻿Name,Year\r\nAmélie,2001\r\n\r\n")).toEqual([{ Name: "Amélie", Year: "2001" }]);
  });

  it("returns no rows for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("detectFile", () => {
  it("recognises Letterboxd export files, even inside the zip folder", () => {
    expect(detectFile("letterboxd-export/watched.csv")).toBe("watched");
    expect(detectFile("DIARY.CSV")).toBe("diary");
    expect(detectFile("ratings.csv")).toBe("ratings");
    expect(detectFile("watchlist.csv")).toBe("watchlist");
    expect(detectFile("reviews.csv")).toBeNull();
  });

  it("ignores deleted, orphaned, likes and lists sub-folders, which reuse the same file names", () => {
    expect(detectFile("deleted/diary.csv")).toBeNull();
    expect(detectFile("Account Settings Nov 16 2026/orphaned/diary.csv")).toBeNull();
    expect(detectFile("likes/films.csv")).toBeNull();
    expect(detectFile("export\\lists\\watched.csv")).toBeNull();
    expect(detectFile("Account Settings Nov 16 2026/diary.csv")).toBe("diary");
  });
});

describe("collectFiles", () => {
  const header = "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n";
  const realDiary = header + "2024-02-01,Heat,1995,d1,4,,,2024-01-31\n2024-02-02,Alien,1979,d2,5,,,2024-02-01\n";

  it("keeps the real diary even when deleted/ and orphaned/ come after it in the zip", () => {
    const files = collectFiles([
      { path: "diary.csv", text: realDiary },
      { path: "deleted/diary.csv", text: header },
      { path: "orphaned/diary.csv", text: header + "2020-01-01,Ghost,2000,x,,,,2020-01-01\n" },
    ]);
    expect(files.diary).toBe(realDiary);
  });

  it("keeps the fuller file when the same name is selected twice", () => {
    expect(collectFiles([{ path: "diary.csv", text: header }, { path: "copy/diary.csv", text: realDiary }]).diary).toBe(realDiary);
  });

  it("returns nothing for unrelated files", () => {
    expect(collectFiles([{ path: "profile.csv", text: "Username\nx\n" }])).toEqual({});
  });
});

describe("mergeLetterboxd", () => {
  const watched = "Date,Name,Year,Letterboxd URI\n2023-01-10,Inception,2010,u1\n2023-02-01,Heat,1995,u2\n";

  it("returns one watched row per film", () => {
    const rows = mergeLetterboxd({ watched });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: "Inception", year: 2010, watched: true, watchedAt: "2023-01-10", rating: null, plays: 1 });
  });

  it("converts 0.5–5 star ratings to 1–10", () => {
    const ratings = "Date,Name,Year,Letterboxd URI,Rating\n2023-05-01,Inception,2010,u1,4.5\n2023-05-01,Heat,1995,u2,0.5\n";
    const rows = mergeLetterboxd({ watched, ratings });
    expect(rows.find((r) => r.name === "Inception")?.rating).toBe(9);
    expect(rows.find((r) => r.name === "Heat")?.rating).toBe(1);
  });

  it("counts diary entries as plays and keeps the latest watch date", () => {
    const diary =
      "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n" +
      "2024-02-01,Inception,2010,d1,5,,,2024-01-31\n" +
      "2025-06-01,Inception,2010,d2,5,Yes,,2025-05-30\n";
    const inception = mergeLetterboxd({ watched, diary }).find((r) => r.name === "Inception");
    expect(inception).toMatchObject({ plays: 2, watchedAt: "2025-05-30", rating: 10 });
  });

  it("lets ratings.csv override the diary rating", () => {
    const diary = "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2024-02-01,Heat,1995,d1,5,,,2024-01-31\n";
    const ratings = "Date,Name,Year,Letterboxd URI,Rating\n2024-03-01,Heat,1995,u2,3\n";
    expect(mergeLetterboxd({ diary, ratings })[0].rating).toBe(6);
  });

  it("treats a rated film as watched, even without watched.csv", () => {
    const ratings = "Date,Name,Year,Letterboxd URI,Rating\n2023-05-01,Stalker,1979,u3,5\n";
    expect(mergeLetterboxd({ ratings })[0]).toMatchObject({ watched: true, plays: 1 });
  });

  it("keeps watchlist-only films as not watched, without overriding watched ones", () => {
    const watchlist = "Date,Name,Year,Letterboxd URI\n2024-01-01,Seven Samurai,1954,w1\n2024-01-01,Inception,2010,w2\n";
    const rows = mergeLetterboxd({ watched, watchlist });
    expect(rows.find((r) => r.name === "Seven Samurai")).toMatchObject({ watched: false, plays: 0 });
    expect(rows.find((r) => r.name === "Inception")?.watched).toBe(true);
  });

  it("distinguishes remakes by year and tolerates a missing year", () => {
    const w = "Date,Name,Year,Letterboxd URI\n2023-01-01,Dune,1984,a\n2023-01-02,Dune,2021,b\n2023-01-03,Mystery,,c\n";
    const rows = mergeLetterboxd({ watched: w });
    expect(rows.map((r) => [r.name, r.year])).toEqual([["Dune", 1984], ["Dune", 2021], ["Mystery", null]]);
  });
});
