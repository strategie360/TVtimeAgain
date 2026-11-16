"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api } from "./client-api";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
        router.refresh(); // re-render serveur : une seule requête par écran
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  return { pending, error, run };
}

const btn = "rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50";

export function MarkNextButton({ showId, episodeId }: { showId: number; episodeId: number }) {
  const { pending, run } = useAction();
  return (
    <button
      aria-label="Marquer comme vu"
      disabled={pending}
      onClick={() => run(() => api(`/shows/${showId}/watched`, "POST", { episodeIds: [episodeId] }))}
      className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border-2 border-accent text-accent hover:bg-accent hover:text-accent-fg disabled:opacity-40"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>
    </button>
  );
}

export function FollowControls({ showId, userStatus, favorite }: { showId: number; userStatus: number | null; favorite: boolean | null }) {
  const { pending, error, run } = useAction();
  if (userStatus === null)
    return (
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => run(() => api(`/shows/${showId}`, "POST", { status: 0 }))} className={`${btn} bg-accent text-accent-fg`}>
          + Je regarde
        </button>
        <button disabled={pending} onClick={() => run(() => api(`/shows/${showId}`, "POST", { status: 1 }))} className={`${btn} bg-surface-2`}>
          À voir plus tard
        </button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={userStatus}
        disabled={pending}
        onChange={(e) => run(() => api(`/shows/${showId}`, "PATCH", { status: Number(e.target.value) }))}
        className="rounded-full border border-border bg-surface-2 px-3 py-2 text-sm"
      >
        <option value={0}>En cours</option>
        <option value={1}>À voir</option>
        <option value={2}>Terminée</option>
        <option value={3}>Abandonnée</option>
      </select>
      <button disabled={pending} onClick={() => run(() => api(`/shows/${showId}`, "PATCH", { favorite: !favorite }))} className={`${btn} bg-surface-2 ${favorite ? "text-accent" : ""}`}>
        {favorite ? "★ Favori" : "☆ Favori"}
      </button>
      <button
        disabled={pending}
        onClick={() => confirm("Ne plus suivre cette série ? Ton historique pour cette série sera effacé.") && run(() => api(`/shows/${showId}`, "DELETE"))}
        className={`${btn} text-muted hover:text-red-400`}
      >
        Ne plus suivre
      </button>
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function MovieControls({ movieId, status, plays }: { movieId: number; status: number | null; plays: number }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      {status === 1 ? (
        <>
          <span className={`${btn} bg-ok/15 text-ok`}>✓ Vu{plays > 1 ? ` ${plays} fois` : ""}</span>
          <button disabled={pending} onClick={() => run(() => api(`/movies/${movieId}/watched`, "POST"))} className={`${btn} bg-surface-2`}>
            ↻ Je l&apos;ai revu
          </button>
        </>
      ) : (
        <button disabled={pending} onClick={() => run(() => api(`/movies/${movieId}/watched`, "POST"))} className={`${btn} bg-accent text-accent-fg`}>
          ✓ Vu
        </button>
      )}
      {status === null && (
        <button disabled={pending} onClick={() => run(() => api(`/movies/${movieId}/watchlist`, "POST"))} className={`${btn} bg-surface-2`}>
          + À voir
        </button>
      )}
      {status !== null && (
        <button disabled={pending} onClick={() => run(() => api(`/movies/${movieId}/watched`, "DELETE"))} className={`${btn} text-muted hover:text-red-400`}>
          Retirer
        </button>
      )}
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await api("/auth/logout", "POST").catch(() => {});
        // Les pages mises en cache hors-ligne sont privées : on les purge.
        if ("caches" in window) await caches.delete("pages-v1").catch(() => {});
        router.replace("/login");
        router.refresh();
      }}
      className="text-xs text-muted hover:text-fg"
    >
      Déconnexion
    </button>
  );
}
