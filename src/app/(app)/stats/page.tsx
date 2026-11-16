import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { getStats } from "@/lib/queries";
import { formatDuration, PageTitle, Poster } from "@/components/ui";

export const metadata = { title: "Statistiques" };

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default async function StatsPage() {
  const user = await pageUser();
  const s = await getStats(user.id);
  // 12 derniers mois, y compris les mois sans visionnage.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 11 + i);
    const key = d.toISOString().slice(0, 7);
    return { key, label: d.toLocaleDateString("fr-FR", { month: "short" }), ...(s.by_month.find((m) => m.month === key) ?? { episodes: 0, minutes: 0 }) };
  });
  const max = Math.max(1, ...months.map((m) => m.minutes));

  return (
    <>
      <PageTitle>Statistiques</PageTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Temps séries" value={formatDuration(s.episode_minutes)} sub={`${s.episodes_watched.toLocaleString("fr-FR")} épisodes`} />
        <Tile label="Temps films" value={formatDuration(s.movie_minutes)} sub={`${s.movies_watched} film${s.movies_watched > 1 ? "s" : ""}`} />
        <Tile label="Séries suivies" value={s.shows_followed} sub={`${s.shows_completed} terminées`} />
        <Tile label="Films à voir" value={s.movies_watchlist} />
      </div>

      <section className="mt-6 rounded-xl bg-surface p-4">
        <h2 className="mb-4 font-semibold">Temps devant les séries, 12 derniers mois</h2>
        <div className="flex h-40 items-end gap-1.5">
          {months.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1" title={`${m.episodes} épisodes · ${formatDuration(m.minutes)}`}>
              <div className="w-full rounded-t bg-accent/90" style={{ height: `${(m.minutes / max) * 100}%`, minHeight: m.minutes ? 3 : 0 }} />
              <span className="text-[10px] text-muted">{m.label}</span>
            </div>
          ))}
        </div>
      </section>

      {s.top_shows.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold">Tes séries les plus regardées</h2>
          <ol className="grid grid-cols-5 gap-2">
            {s.top_shows.map((t) => (
              <li key={t.show_id}>
                <Link href={`/show/${t.show_id}`} className="block space-y-1">
                  <Poster path={t.poster_path} alt={t.name} />
                  <p className="truncate text-xs text-muted">{t.watched_count} ép.</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
