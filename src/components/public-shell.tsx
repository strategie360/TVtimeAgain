import Link from "next/link";
import { Logo } from "./logo";

/** Mise en page des pages publiques (lisibles sans compte). */
export function PublicShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-xl">
        <Logo />
      </Link>
      <h1 className="mb-6 mt-6 text-2xl font-bold">{title}</h1>
      <div className="space-y-4 text-sm leading-relaxed text-fg/90 [&_a]:text-accent [&_a]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
      <SiteFooter />
    </main>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-xs text-muted">
      <Link href="/about" className="hover:text-fg">À propos</Link>
      <Link href="/privacy" className="hover:text-fg">Confidentialité</Link>
      <span>Données films et séries : TMDB</span>
    </footer>
  );
}
