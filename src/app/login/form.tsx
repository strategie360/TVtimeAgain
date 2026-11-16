"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/client-api";
import { PasswordInput } from "@/components/password-input";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const input = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent";

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        try {
          await api(`/auth/${mode}`, "POST", Object.fromEntries(f));
          router.replace("/");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Erreur");
          setPending(false);
        }
      }}
    >
      {mode === "register" && <input name="displayName" placeholder="Pseudo" required maxLength={50} className={input} autoComplete="nickname" />}
      <input name="email" type="email" placeholder="Email" required className={input} autoComplete="email" />
      <PasswordInput
        name="password"
        placeholder="Mot de passe"
        aria-label="Mot de passe"
        required
        minLength={mode === "register" ? 8 : 1}
        className={input}
        autoComplete={mode === "register" ? "new-password" : "current-password"}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-accent py-2.5 font-semibold text-accent-fg disabled:opacity-50">
        {mode === "login" ? "Se connecter" : "Créer mon compte"}
      </button>
      <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="w-full text-sm text-muted hover:text-fg">
        {mode === "login" ? "Pas de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
      </button>
    </form>
  );
}
