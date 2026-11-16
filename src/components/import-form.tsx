"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { unzipSync, strFromU8 } from "fflate";
import { collectFiles, detectFile, mergeLetterboxd } from "@/lib/letterboxd";
import type { ImportProgress, ImportRow } from "@/lib/imports";
import { api } from "./client-api";

type Progress = Omit<ImportProgress, "stalled">;

export function ImportForm() {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);

  async function readFiles(list: FileList) {
    setError(null);
    const entries: { path: string; text: string }[] = [];
    for (const f of Array.from(list)) {
      if (f.name.toLowerCase().endsWith(".zip")) {
        const zip = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: (e) => detectFile(e.name) !== null });
        for (const [name, data] of Object.entries(zip)) entries.push({ path: name, text: strFromU8(data) });
      } else {
        entries.push({ path: f.webkitRelativePath || f.name, text: await f.text() });
      }
    }
    const files = collectFiles(entries);
    if (!Object.keys(files).length) return setError("Aucun fichier Letterboxd reconnu (watched.csv, diary.csv, ratings.csv, watchlist.csv).");
    setRows(mergeLetterboxd(files));
  }

  async function start() {
    if (!rows) return;
    setBusy(true);
    try {
      const r = await api<{ id: number }>("/imports", "POST", { source: "letterboxd", items: rows });
      setProgress({ id: r.id, status: 0, total: rows.length, processed: 0, matched: 0, not_found: [], shows: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  // Suivi de progression : un GET léger toutes les 1,5 s.
  useEffect(() => {
    if (!progress || progress.status === 2) return;
    const t = setTimeout(async () => {
      const p = await api<Progress>(`/imports/${progress.id}`).catch(() => null);
      if (p) setProgress(p);
    }, 1500);
    return () => clearTimeout(t);
  }, [progress]);

  if (progress) {
    const pct = Math.round((progress.processed / Math.max(1, progress.total)) * 100);
    const done = progress.status === 2;
    return (
      <div className="space-y-4 rounded-xl bg-surface p-5">
        <p className="font-semibold">{done ? "Import terminé 🎉" : "Import en cours…"}</p>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-muted">
          {progress.processed} / {progress.total} traités · {progress.matched} films reconnus
          {!done && " · tu peux quitter la page, l'import continue."}
        </p>
        {done && progress.shows.length > 0 && (
          <div className="rounded-lg bg-surface-2 p-3 text-sm">
            <p className="mb-2">
              {progress.shows.length} titre(s) de ton export sont des <b>séries</b>, pas des films. Ouvre-les pour les
              suivre et cocher tes épisodes :
            </p>
            <ul className="flex flex-wrap gap-2">
              {progress.shows.map((s) => (
                <li key={s.show_id}>
                  <Link href={`/show/${s.show_id}`} className="inline-block rounded-full bg-surface px-3 py-1 hover:text-accent">
                    {s.name}{s.year ? ` (${s.year})` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {done && progress.not_found.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">{progress.not_found.length} titre(s) non reconnu(s)</summary>
            <ul className="mt-2 list-disc pl-5 text-muted">
              {progress.not_found.map((n, i) => (
                <li key={i}>{n.name}{n.year ? ` (${n.year})` : ""}</li>
              ))}
            </ul>
          </details>
        )}
        {done && (
          <div className="flex gap-2">
            <Link href="/movies" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">Voir mes films</Link>
            <Link href="/discover" className="rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold">Mes recommandations</Link>
          </div>
        )}
      </div>
    );
  }

  const watched = rows?.filter((r) => r.watched).length ?? 0;
  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Sur letterboxd.com : Settings → Import &amp; Export → <b>Export Your Data</b>.</li>
        <li>Choisis le fichier .zip reçu (ou les fichiers .csv) ci-dessous.</li>
      </ol>
      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-accent">
        <input type="file" accept=".zip,.csv" multiple className="hidden" onChange={(e) => e.target.files && readFiles(e.target.files)} />
        <span className="font-semibold">Choisir l&apos;export Letterboxd</span>
        <span className="mt-1 block text-xs text-muted">Le fichier est lu sur ton appareil, seuls les titres sont envoyés.</span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {rows && (
        <div className="space-y-3 rounded-xl bg-surface p-4">
          <p>
            <b>{watched}</b> films vus, <b>{rows.filter((r) => r.rating).length}</b> notes, <b>{rows.length - watched}</b> dans la watchlist.
          </p>
          <button disabled={busy || !rows.length} onClick={start} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50">
            Importer {rows.length} films
          </button>
        </div>
      )}
    </div>
  );
}
