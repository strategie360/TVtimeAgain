import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./form";

export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-black">
        Next<span className="text-accent">Up</span>
      </h1>
      <p className="mb-8 text-muted">Suis tes séries et tes films, épisode par épisode.</p>
      <LoginForm />
    </main>
  );
}
