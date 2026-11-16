import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { MovieStatus } from "@/db/schema";
import { getMovies } from "@/lib/queries";
import { Empty, PageTitle, Poster } from "@/components/ui";

export const metadata = { title: "Mes films" };

export default async function MoviesPage() {
  const user = await pageUser();
  const items = await getMovies(user.id);
  const actions = (
    <div className="mb-5 grid grid-cols-2 gap-2 text-sm font-semibold">
      <Link href="/quick?kind=movie" className="rounded-xl bg-surface p-3 text-center hover:bg-surface-2">✓ Cocher mes films déjà vus</Link>
      <Link href="/import" className="rounded-xl bg-surface p-3 text-center hover:bg-surface-2">⇪ Importer Letterboxd</Link>
    </div>
  );
  if (!items.length) return (<><PageTitle>Mes films</PageTitle>{actions}<Empty>Aucun film pour l&apos;instant.</Empty></>);

  const sections = [
    { label: "À voir", items: items.filter((m) => m.status === MovieStatus.watchlist) },
    { label: "Vus", items: items.filter((m) => m.status === MovieStatus.watched) },
  ].filter((s) => s.items.length);
  return (
    <>
      <PageTitle>Mes films</PageTitle>
      {actions}
      {sections.map((s) => (
        <section key={s.label} className="mb-6">
          <h2 className="mb-3 font-semibold">{s.label} <span className="text-muted">({s.items.length})</span></h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {s.items.map((m) => (
              <li key={m.id}>
                <Link href={`/movie/${m.id}`} className="block space-y-1.5">
                  <Poster path={m.poster_path} alt={m.title} />
                  <p className="truncate text-xs">{m.title}{m.plays > 1 ? ` ×${m.plays}` : ""}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
