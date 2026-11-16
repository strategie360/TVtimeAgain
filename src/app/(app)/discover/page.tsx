import Link from "next/link";
import { after } from "next/server";
import { pageUser } from "@/lib/auth";
import { recommendRows } from "@/lib/recs";
import { RecCard } from "@/components/rec-card";
import { RecRowCarousel } from "@/components/rec-row";
import { Empty, PageTitle } from "@/components/ui";

export const metadata = { title: "Pour toi" };

const MAIN_CARDS = 6; // titres de la sélection principale affichés en cartes (avec boutons)

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await pageUser();
  const kind = (await searchParams).kind === "show" ? "show" : "movie";
  const rows = await recommendRows(user.id, { kind, background: (p) => after(p) });
  const [main, ...others] = rows;
  const personal = (main?.items ?? []).filter((r) => r.reason !== "Incontournable du moment").length;
  const rest = main ? { ...main, id: "for-you-more", title: "Encore pour toi", items: main.items.slice(MAIN_CARDS) } : null;

  return (
    <>
      <PageTitle sub="Calculé à partir de ce que tu as vu, noté et abandonné.">Pour toi</PageTitle>
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/discover" className={`rounded-full px-3 py-1 ${kind === "movie" ? "bg-accent text-accent-fg" : "bg-surface"}`}>Films</Link>
        <Link href="/discover?kind=show" className={`rounded-full px-3 py-1 ${kind === "show" ? "bg-accent text-accent-fg" : "bg-surface"}`}>Séries</Link>
      </div>
      {personal < 5 && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          Plus tu en dis, meilleures sont les suggestions.{" "}
          <Link href={`/quick?kind=${kind === "movie" ? "movie" : "tv"}`} className="font-semibold text-accent underline">Coche ce que tu as déjà vu</Link>
          {" "}ou{" "}
          <Link href="/import" className="font-semibold text-accent underline">importe Letterboxd</Link>.
        </div>
      )}
      {!main || !main.items.length ? (
        <Empty>Rien à proposer pour l&apos;instant.</Empty>
      ) : (
        <>
          <ul className="mb-7 space-y-3">
            {main.items.slice(0, MAIN_CARDS).map((r) => (
              <RecCard key={`${r.kind}-${r.id}`} rec={r} />
            ))}
          </ul>
          {others.map((row) => (
            <RecRowCarousel key={row.id} row={row} />
          ))}
          {rest && rest.items.length > 0 && <RecRowCarousel row={rest} />}
        </>
      )}
    </>
  );
}
