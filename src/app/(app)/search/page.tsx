import Link from "next/link";
import { searchMulti } from "@/lib/tmdb";
import { Empty, PageTitle, Poster } from "@/components/ui";

export const metadata = { title: "Recherche" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  if (q.length < 2) return <Empty>Tape au moins 2 caractères.</Empty>;
  let results: Awaited<ReturnType<typeof searchMulti>> = [];
  let error: string | null = null;
  try {
    results = await searchMulti(q);
  } catch (e) {
    error = e instanceof Error ? e.message : "Recherche indisponible";
  }
  return (
    <>
      <PageTitle sub={`« ${q} »`}>Recherche</PageTitle>
      {error ? (
        <Empty>{error}</Empty>
      ) : !results.length ? (
        <Empty>Aucun résultat.</Empty>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {results.slice(0, 20).map((r) => {
            const title = r.name ?? r.title ?? "";
            const year = (r.first_air_date ?? r.release_date ?? "").slice(0, 4);
            return (
              <li key={`${r.media_type}-${r.id}`}>
                <Link href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`} className="block space-y-1">
                  <Poster path={r.poster_path} alt={title} />
                  <p className="truncate text-xs">{title}</p>
                  <p className="text-[11px] text-muted">{r.media_type === "tv" ? "Série" : "Film"}{year ? ` · ${year}` : ""}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
