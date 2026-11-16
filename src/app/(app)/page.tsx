import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { getUpNext } from "@/lib/queries";
import { Empty, epCode, formatDate, PageTitle, Poster, Progress } from "@/components/ui";
import { MarkNextButton } from "@/components/actions";

export const metadata = { title: "À suivre" };

export default async function UpNextPage() {
  const user = await pageUser();
  const items = await getUpNext(user.id);
  const today = new Date().toISOString().slice(0, 10);

  if (!items.length)
    return (
      <>
        <PageTitle>À suivre</PageTitle>
        <Empty href="/search?q=a" cta="Trouver une série">
          Tu ne suis encore aucune série. Cherche-en une en haut de l&apos;écran.
        </Empty>
      </>
    );

  return (
    <>
      <PageTitle sub={`${items.length} série${items.length > 1 ? "s" : ""} en cours`}>À suivre</PageTitle>
      <ul className="space-y-3">
        {items.map((it) => {
          const aired = it.air_date != null && it.air_date <= today;
          return (
            <li key={it.show_id} className="flex gap-3 rounded-xl bg-surface p-3">
              <Link href={`/show/${it.show_id}`} className="w-16 shrink-0">
                <Poster path={it.poster_path} alt={it.name} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div>
                  <Link href={`/show/${it.show_id}`} className="block truncate font-semibold">
                    {it.name}
                  </Link>
                  {it.episode_id ? (
                    <p className="truncate text-sm text-muted">
                      <span className="font-mono text-fg">{epCode(it.season!, it.number!)}</span>
                      {it.episode_name ? ` · ${it.episode_name}` : ""}
                      {!aired && <span className="ml-1 text-accent">· {formatDate(it.air_date, { day: "numeric", month: "short" })}</span>}
                    </p>
                  ) : (
                    <p className="text-sm text-ok">À jour ✓</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={it.watched_count} max={it.aired_episodes} />
                  <span className="shrink-0 text-xs text-muted">
                    {it.watched_count}/{it.aired_episodes}
                  </span>
                </div>
              </div>
              {it.episode_id && aired && <MarkNextButton showId={it.show_id} episodeId={it.episode_id} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}
