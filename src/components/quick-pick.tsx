"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "./client-api";
import { Poster } from "./ui";

type Item = { id: number; title: string; year: string | null; poster_path: string | null; seen: boolean };
type Page = { page: number; totalPages: number; items: Item[] };

/**
 * Sélection rapide « déjà vu » : on tape les affiches, on valide une fois.
 * Une seule requête d'écriture pour toute la sélection.
 */
export function QuickPick({ kind }: { kind: "movie" | "tv" }) {
  const router = useRouter();
  const [list, setList] = useState<"most_voted" | "popular">("most_voted");
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, l: string, reset: boolean) => {
      setLoading(true);
      const r = await api<Page>(`/quick?kind=${kind}&list=${l}&page=${p}`).catch(() => null);
      setLoading(false);
      if (!r) return;
      setTotal(r.totalPages);
      setPage(p);
      setItems((cur) => {
        const merged = reset ? r.items : [...cur, ...r.items];
        return [...new Map(merged.map((x) => [x.id, x])).values()];
      });
    },
    [kind],
  );

  useEffect(() => {
    load(1, list, true);
  }, [list, load]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const ids = [...selected];
      const max = kind === "movie" ? 200 : 50;
      for (let i = 0; i < ids.length; i += max) await api(kind === "movie" ? "/movies/batch" : "/shows/batch", "POST", { ids: ids.slice(i, i + max) });
      setItems((cur) => cur.map((x) => (selected.has(x.id) ? { ...x, seen: true } : x)));
      setMsg(`${ids.length} ${kind === "movie" ? "film" : "série"}${ids.length > 1 ? "s" : ""} ajouté${ids.length > 1 ? "s" : ""} ✓`);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/quick?kind=movie" className={`rounded-full px-3 py-1 ${kind === "movie" ? "bg-accent text-accent-fg" : "bg-surface"}`}>Films</Link>
        <Link href="/quick?kind=tv" className={`rounded-full px-3 py-1 ${kind === "tv" ? "bg-accent text-accent-fg" : "bg-surface"}`}>Séries</Link>
        <span className="mx-1 w-px bg-border" />
        {(["most_voted", "popular"] as const).map((l) => (
          <button key={l} onClick={() => setList(l)} className={`rounded-full px-3 py-1 ${list === l ? "bg-fg text-bg" : "bg-surface"}`}>
            {l === "most_voted" ? "Les plus vus" : "Du moment"}
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm text-muted">
        Touche tout ce que tu as déjà vu{kind === "tv" ? " (la série sera marquée entièrement vue)" : ""}, puis valide.
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {items.map((it) => {
          const on = selected.has(it.id);
          return (
            <li key={it.id}>
              <button
                disabled={it.seen}
                onClick={() => toggle(it.id)}
                className={`relative block w-full rounded-lg text-left transition ${on ? "ring-4 ring-accent" : ""} ${it.seen ? "opacity-40" : "active:scale-95"}`}
              >
                <Poster path={it.poster_path} alt={it.title} />
                {(on || it.seen) && (
                  <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-fg">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                  </span>
                )}
              </button>
              <p className="mt-1 truncate text-[11px] text-muted">{it.title}{it.year ? ` · ${it.year}` : ""}</p>
            </li>
          );
        })}
      </ul>
      {page < total && (
        <button disabled={loading} onClick={() => load(page + 1, list, false)} className="mt-4 w-full rounded-full bg-surface py-2 text-sm disabled:opacity-50">
          {loading ? "Chargement…" : "Voir plus"}
        </button>
      )}
      <div className="sticky bottom-20 mt-4 flex items-center justify-between gap-3 rounded-full bg-surface-2/95 p-2 pl-4 shadow-lg backdrop-blur md:bottom-4">
        <span className="text-sm">{msg ?? `${selected.size} sélectionné${selected.size > 1 ? "s" : ""}`}</span>
        <button disabled={!selected.size || saving} onClick={save} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-40">
          {saving ? "Ajout…" : "J'ai vu tout ça"}
        </button>
      </div>
    </div>
  );
}
