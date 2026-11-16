import Link from "next/link";
import { img } from "@/lib/tmdb";

export function Poster({ path, alt, className = "" }: { path: string | null; alt: string; className?: string }) {
  const src = img(path, "w342");
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 ${className}`}>
      {src ? (
        // Pas de next/image : les images viennent déjà redimensionnées du CDN TMDB
        // (aucun coût d'optimisation ni de bande passante chez nous).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">{alt}</div>
      )}
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-label={`${pct} %`}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </header>
  );
}

export function Empty({ children, href, cta }: { children: React.ReactNode; href?: string; cta?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
      <p>{children}</p>
      {href && (
        <Link href={href} className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          {cta}
        </Link>
      )}
    </div>
  );
}

export const epCode = (s: number, n: number) => `S${String(s).padStart(2, "0")}E${String(n).padStart(2, "0")}`;

export function formatDate(d: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "Date inconnue";
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("fr-FR", opts);
}

export function formatDuration(minutes: number) {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return [d && `${d} j`, h && `${h} h`, (!d && m) || (!d && !h) ? `${m} min` : null].filter(Boolean).join(" ");
}
