/**
 * Lecture d'un export Letterboxd, côté navigateur (le zip n'est jamais envoyé :
 * on n'envoie que des lignes compactes, ~50 octets par film).
 *
 * Fichiers utilisés (Letterboxd > Settings > Import & Export > Export your data) :
 *   watched.csv   : Date, Name, Year, Letterboxd URI          -> films vus
 *   diary.csv     : …, Rating, Rewatch, Tags, Watched Date     -> dates + revisionnages
 *   ratings.csv   : Date, Name, Year, Letterboxd URI, Rating   -> notes (sur 5, demi-étoiles)
 *   watchlist.csv : Date, Name, Year, Letterboxd URI           -> à voir
 */
import type { ImportRow } from "./imports";

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows.filter((r) => r.some((c) => c.trim()));
  if (!header) return [];
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

type Files = Partial<Record<"watched" | "diary" | "ratings" | "watchlist", string>>;

/**
 * Sous-dossiers de l'export à ne jamais importer. `deleted/diary.csv` (entrées supprimées) et
 * `orphaned/diary.csv` ont le même nom et le même en-tête que le vrai journal.
 */
const IGNORED_FOLDERS = new Set(["deleted", "orphaned", "likes", "lists"]);

/** Type de fichier Letterboxd d'après son chemin (dans le zip ou sur le disque), ou null. */
export function detectFile(path: string): keyof Files | null {
  const parts = path.toLowerCase().split(/[\\/]/);
  const f = parts.pop() ?? "";
  if (parts.some((p) => IGNORED_FOLDERS.has(p))) return null;
  if (f === "watched.csv") return "watched";
  if (f === "diary.csv") return "diary";
  if (f === "ratings.csv") return "ratings";
  if (f === "watchlist.csv") return "watchlist";
  return null;
}

const dataLines = (text: string) => text.split(/\r?\n/).filter((l) => l.trim()).length;

/**
 * Choisit le bon fichier pour chaque type. Si plusieurs fichiers ont le même nom (exports dans des
 * dossiers différents, fichiers choisis à la main), garde celui qui contient le plus de lignes.
 */
export function collectFiles(entries: { path: string; text: string }[]): Files {
  const files: Files = {};
  for (const { path, text } of entries) {
    const kind = detectFile(path);
    if (!kind) continue;
    const current = files[kind];
    if (current === undefined || dataLines(text) > dataLines(current)) files[kind] = text;
  }
  return files;
}

const toRating = (v: string | undefined) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? Math.min(10, Math.max(1, Math.round(n * 2))) : null;
};
const toYear = (v: string | undefined) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 1870 && n < 2100 ? n : null;
};
const toDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const maxDate = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** Fusionne les fichiers en une ligne par film (clé titre|année). */
export function mergeLetterboxd(files: Files): ImportRow[] {
  const map = new Map<string, ImportRow>();
  const get = (name: string, year: number | null) => {
    const key = `${name.toLowerCase()}|${year ?? ""}`;
    let r = map.get(key);
    if (!r) {
      r = { name, year, watched: false, watchedAt: null, rating: null, plays: 0 };
      map.set(key, r);
    }
    return r;
  };

  for (const r of files.watched ? parseCsv(files.watched) : []) {
    if (!r.Name) continue;
    const it = get(r.Name, toYear(r.Year));
    it.watched = true;
    it.watchedAt = maxDate(it.watchedAt, toDate(r.Date));
  }
  const diaryPlays = new Map<ImportRow, number>();
  for (const r of files.diary ? parseCsv(files.diary) : []) {
    if (!r.Name) continue;
    const it = get(r.Name, toYear(r.Year));
    it.watched = true;
    it.watchedAt = maxDate(it.watchedAt, toDate(r["Watched Date"]) ?? toDate(r.Date));
    it.rating = toRating(r.Rating) ?? it.rating;
    diaryPlays.set(it, (diaryPlays.get(it) ?? 0) + 1);
  }
  for (const r of files.ratings ? parseCsv(files.ratings) : []) {
    if (!r.Name) continue;
    const it = get(r.Name, toYear(r.Year));
    it.watched = true; // noter un film = l'avoir vu
    it.rating = toRating(r.Rating) ?? it.rating;
  }
  for (const r of files.watchlist ? parseCsv(files.watchlist) : []) {
    if (r.Name) get(r.Name, toYear(r.Year));
  }
  for (const it of map.values()) it.plays = it.watched ? Math.max(1, diaryPlays.get(it) ?? 1) : 0;
  return [...map.values()];
}
