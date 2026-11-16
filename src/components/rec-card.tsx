"use client";
import Link from "next/link";
import { useState } from "react";
import type { Recommendation } from "@/lib/recs";
import { api } from "./client-api";
import { Poster } from "./ui";

/** Carte de recommandation : vu / à voir / pas pour moi, sans recharger la page. */
export function RecCard({ rec }: { rec: Recommendation }) {
  const [state, setState] = useState<null | "seen" | "later" | "no">(null);
  const href = `/${rec.kind}/${rec.id}`;
  const act = async (s: "seen" | "later" | "no") => {
    setState(s);
    try {
      if (s === "no") await api("/recommendations/feedback", "POST", { kind: rec.kind, id: rec.id });
      else if (rec.kind === "movie") await api(s === "seen" ? `/movies/${rec.id}/watched` : `/movies/${rec.id}/watchlist`, "POST");
      else if (s === "seen") await api("/shows/batch", "POST", { ids: [rec.id] });
      else await api(`/shows/${rec.id}`, "POST", { status: 1 });
    } catch {
      setState(null);
    }
  };
  if (state)
    return (
      <li className="flex items-center justify-between rounded-xl bg-surface p-3 text-sm text-muted">
        <span className="truncate">
          {rec.title} · {state === "seen" ? "ajouté à tes vus" : state === "later" ? "ajouté à voir" : "on ne te le proposera plus"}
        </span>
        <button onClick={() => setState(null)} className="shrink-0 text-xs underline">Annuler l&apos;affichage</button>
      </li>
    );
  return (
    <li className="flex gap-3 rounded-xl bg-surface p-3">
      <Link href={href} className="w-20 shrink-0">
        <Poster path={rec.poster_path} alt={rec.title} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div>
          <Link href={href} className="block truncate font-semibold">{rec.title}</Link>
          <p className="text-xs text-muted">{rec.kind === "movie" ? "Film" : "Série"}{rec.year ? ` · ${rec.year}` : ""}</p>
          <p className="mt-1 line-clamp-2 text-sm text-accent/90">{rec.reason}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <button onClick={() => act("later")} className="rounded-full bg-accent px-3 py-1.5 text-accent-fg">+ À voir</button>
          <button onClick={() => act("seen")} className="rounded-full bg-surface-2 px-3 py-1.5">Déjà vu</button>
          <button onClick={() => act("no")} className="rounded-full px-3 py-1.5 text-muted hover:text-fg">Pas pour moi</button>
        </div>
      </div>
    </li>
  );
}
