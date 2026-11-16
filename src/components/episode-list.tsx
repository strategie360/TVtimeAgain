"use client";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import type { EpisodeRow } from "@/lib/queries";
import { api } from "./client-api";
import { epCode, formatDate } from "./ui";

type Change = { ids: number[]; watched: boolean };

/**
 * Liste des épisodes avec mise à jour optimiste : la case se coche
 * instantanément, la requête part en arrière-plan, puis le serveur
 * re-rend la page (progression, prochain épisode).
 */
export function EpisodeList({ showId, episodes, canEdit }: { showId: number; episodes: EpisodeRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [eps, apply] = useOptimistic(episodes, (cur, c: Change) => cur.map((e) => (c.ids.includes(e.id) ? { ...e, watched: c.watched } : e)));
  const today = new Date().toISOString().slice(0, 10);

  const seasons = useMemo(() => {
    const m = new Map<number, EpisodeRow[]>();
    for (const e of eps) m.set(e.season, [...(m.get(e.season) ?? []), e]);
    return [...m];
  }, [eps]);
  const firstOpen = seasons.find(([s, list]) => s > 0 && list.some((e) => !e.watched && e.air_date && e.air_date <= today))?.[0];
  const [open, setOpen] = useState<number | undefined>(firstOpen ?? seasons[0]?.[0]);

  const send = (ids: number[], watched: boolean, payload: object) =>
    start(async () => {
      apply({ ids, watched });
      setError(null);
      try {
        await api(`/shows/${showId}/watched`, watched ? "POST" : "DELETE", payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
      router.refresh();
    });

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {seasons.map(([season, list]) => {
        const aired = list.filter((e) => e.air_date && e.air_date <= today);
        const done = aired.filter((e) => e.watched).length;
        const all = aired.length > 0 && done === aired.length;
        return (
          <section key={season} className="overflow-hidden rounded-xl bg-surface">
            <div className="flex items-center gap-3 p-3">
              <button onClick={() => setOpen(open === season ? undefined : season)} className="flex flex-1 items-center gap-2 text-left">
                <span className={`text-muted transition ${open === season ? "rotate-90" : ""}`}>▸</span>
                <span className="font-semibold">{season === 0 ? "Épisodes spéciaux" : `Saison ${season}`}</span>
                <span className="text-sm text-muted">{done}/{aired.length || list.length}</span>
              </button>
              {canEdit && aired.length > 0 && (
                <button
                  onClick={() => send(aired.map((e) => e.id), !all, { season })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${all ? "bg-surface-2 text-muted" : "bg-accent text-accent-fg"}`}
                >
                  {all ? "Tout décocher" : "Saison vue"}
                </button>
              )}
            </div>
            {open === season && (
              <ul className="divide-y divide-border border-t border-border">
                {list.map((e) => {
                  const isAired = !!e.air_date && e.air_date <= today;
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-mono text-muted">{epCode(e.season, e.number)}</span> {e.name ?? `Épisode ${e.number}`}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDate(e.air_date)}
                          {e.runtime ? ` · ${e.runtime} min` : ""}
                        </p>
                      </div>
                      {canEdit && isAired && (
                        <>
                          {!e.watched && (
                            <button
                              title="Tout marquer jusqu'ici"
                              onClick={() =>
                                send(
                                  eps.filter((x) => x.season > 0 && x.air_date && x.air_date <= today && (x.season < e.season || (x.season === e.season && x.number <= e.number))).map((x) => x.id),
                                  true,
                                  { upToEpisodeId: e.id },
                                )
                              }
                              className="text-xs text-muted hover:text-accent"
                            >
                              jusqu&apos;ici
                            </button>
                          )}
                          <button
                            aria-label={e.watched ? "Marquer non vu" : "Marquer vu"}
                            onClick={() => send([e.id], !e.watched, { episodeIds: [e.id] })}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                              e.watched ? "border-accent bg-accent text-accent-fg" : "border-border text-transparent hover:border-accent"
                            }`}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
                          </button>
                        </>
                      )}
                      {!isAired && <span className="text-xs text-accent">À venir</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
