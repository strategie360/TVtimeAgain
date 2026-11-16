import Link from "next/link";
import type { RecRow } from "@/lib/recs";
import { Poster } from "./ui";

/** Une rangée de recommandations qui défile horizontalement (affiches cliquables). */
export function RecRowCarousel({ row }: { row: RecRow }) {
  return (
    <section aria-labelledby={`row-${row.id}`} className="mb-7">
      <h2 id={`row-${row.id}`} className="font-semibold">{row.title}</h2>
      {row.subtitle && <p className="text-xs text-muted">{row.subtitle}</p>}
      <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {row.items.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="w-28 shrink-0 snap-start">
            <Link href={`/${r.kind}/${r.id}`} title={r.reason} className="block space-y-1">
              <Poster path={r.poster_path} alt={r.title} />
              <p className="truncate text-xs">{r.title}</p>
              {r.year && <p className="text-[11px] text-muted">{r.year}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
