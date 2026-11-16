"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./client-api";

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="rounded-full border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10">
        Supprimer mon compte
      </button>
    );

  return (
    <form
      className="space-y-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        try {
          await api("/me", "DELETE", { password: new FormData(e.currentTarget).get("password") });
          if ("caches" in window) await caches.delete("pages-v1").catch(() => {});
          router.replace("/login?deleted=1");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
          setPending(false);
        }
      }}
    >
      <p className="text-sm">
        Ton compte, tes séries, tes épisodes vus, tes films, tes notes et tes imports seront <b>définitivement effacés</b>.
        Pense à télécharger tes données avant.
      </p>
      <label className="block text-sm">
        Confirme avec ton mot de passe
        <input name="password" type="password" required autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-red-400" />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Suppression…" : "Supprimer définitivement"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm text-muted">Annuler</button>
      </div>
    </form>
  );
}
