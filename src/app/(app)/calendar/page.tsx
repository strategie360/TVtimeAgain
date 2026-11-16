import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { getCalendar, type CalendarItem } from "@/lib/queries";
import { Empty, epCode, formatDate, PageTitle, Poster } from "@/components/ui";

export const metadata = { title: "Calendrier" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ past?: string }> }) {
  const user = await pageUser();
  const past = (await searchParams).past === "1";
  const now = Date.now();
  const from = new Date(past ? now - 30 * 864e5 : now).toISOString().slice(0, 10);
  const to = new Date(past ? now - 864e5 : now + 60 * 864e5).toISOString().slice(0, 10);
  const items = await getCalendar(user.id, from, to);

  const byDay = new Map<string, CalendarItem[]>();
  for (const it of past ? [...items].reverse() : items) {
    const list = byDay.get(it.air_date) ?? [];
    list.push(it);
    byDay.set(it.air_date, list);
  }

  return (
    <>
      <PageTitle sub={past ? "30 derniers jours" : "60 prochains jours"}>Calendrier</PageTitle>
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/calendar" className={`rounded-full px-3 py-1 ${!past ? "bg-accent text-accent-fg" : "bg-surface"}`}>À venir</Link>
        <Link href="/calendar?past=1" className={`rounded-full px-3 py-1 ${past ? "bg-accent text-accent-fg" : "bg-surface"}`}>Récents</Link>
      </div>
      {!items.length ? (
        <Empty>Aucun épisode sur cette période pour les séries que tu suis.</Empty>
      ) : (
        <div className="space-y-5">
          {[...byDay].map(([day, eps]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-muted">
                {formatDate(day, { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              <ul className="space-y-2">
                {eps.map((e) => (
                  <li key={e.episode_id}>
                    <Link href={`/show/${e.show_id}`} className="flex items-center gap-3 rounded-xl bg-surface p-2">
                      <Poster path={e.poster_path} alt={e.show_name} className="w-10 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.show_name}</p>
                        <p className="truncate text-sm text-muted">
                          <span className="font-mono">{epCode(e.season, e.number)}</span>
                          {e.episode_name ? ` · ${e.episode_name}` : ""}
                          {e.network ? ` · ${e.network}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
