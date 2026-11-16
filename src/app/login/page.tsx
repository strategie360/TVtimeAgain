import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./form";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/public-shell";
import { APP_TAGLINE } from "@/lib/brand";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  if (await getUser()) redirect("/");
  const deleted = (await searchParams).deleted === "1";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl">
        <Logo />
      </h1>
      <p className="mb-8 text-muted">{APP_TAGLINE}</p>
      {deleted && (
        <p role="status" className="mb-6 rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">
          Ton compte et toutes tes données ont été supprimés.
        </p>
      )}
      <LoginForm />
      <SiteFooter />
    </main>
  );
}
