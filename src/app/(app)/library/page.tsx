import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { getLibrary } from "@/lib/queries";
import { Empty, PageTitle, Poster, Progress } from "@/components/ui";

export const metadata = { title: "Mes séries" };
const LABELS = ["En cours", "À voir", "Terminées", "Abandonnées"];

export default async function LibraryPage() {
  const user = await pageUser();
  const items = await getLibrary(user.id);
  if (!items.length) return (<><PageTitle>Mes séries</PageTitle><Empty href="/quick?kind=tv" cta="Cocher mes séries déjà vues">Aucune série pour l&apos;instant.</Empty></>);

  const groups = LABELS.map((label, status) => ({ label, items: items.filter((i) => i.status === status) })).filter((g) => g.items.length);
  return (
    <>
      <PageTitle sub={`${items.length} séries`}>Mes séries</PageTitle>
      <Link href="/quick?kind=tv" className="mb-5 block rounded-xl bg-surface p-3 text-center text-sm font-semibold hover:bg-surface-2">✓ Cocher les séries que j&apos;ai déjà finies</Link>
      {groups.map((g) => (
        <section key={g.label} className="mb-6">
          <h2 className="mb-3 font-semibold">
            {g.label} <span className="text-muted">({g.items.length})</span>
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {g.items.map((s) => (
              <li key={s.show_id}>
                <Link href={`/show/${s.show_id}`} className="block space-y-1.5">
                  <Poster path={s.poster_path} alt={s.name} />
                  <Progress value={s.watched_count} max={s.aired_episodes} />
                  <p className="truncate text-xs">{s.favorite ? "★ " : ""}{s.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
