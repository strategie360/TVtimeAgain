import { notFound } from "next/navigation";
import { after } from "next/server";
import { pageUser } from "@/lib/auth";
import { ensureShow } from "@/lib/catalog";
import { getShowDetail } from "@/lib/queries";
import { img } from "@/lib/tmdb";
import { EpisodeList } from "@/components/episode-list";
import { FollowControls } from "@/components/actions";
import { Stars } from "@/components/stars";
import { formatDate, Poster, Progress } from "@/components/ui";

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await pageUser();
  if (!(await ensureShow(id, { background: (p) => after(p) }))) notFound();
  const data = await getShowDetail(id, user.id);
  if (!data) notFound();
  const { show, episodes } = data;
  const backdrop = img(show.backdrop_path, "w780");

  return (
    <article>
      <div className="relative -mx-4 mb-4 overflow-hidden md:mx-0 md:rounded-2xl">
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="relative flex gap-4 bg-gradient-to-t from-bg via-bg/70 to-transparent p-4 pt-10">
          <Poster path={show.poster_path} alt={show.name} className="w-28 shrink-0 shadow-xl" />
          <div className="flex min-w-0 flex-col justify-end gap-2">
            <h1 className="text-2xl font-bold leading-tight">{show.name}</h1>
            <p className="text-sm text-muted">
              {[show.first_air_date?.slice(0, 4), show.network, show.status === "Ended" ? "Terminée" : show.status === "Canceled" ? "Annulée" : "En production", `${show.season_count} saison${show.season_count > 1 ? "s" : ""}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {show.user_status !== null && (
              <div className="flex items-center gap-2">
                <Progress value={show.watched_count ?? 0} max={show.aired_episodes} />
                <span className="shrink-0 text-xs text-muted">{show.watched_count}/{show.aired_episodes}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mb-4 space-y-3">
        <FollowControls showId={show.id} userStatus={show.user_status} favorite={show.favorite} />
        {show.user_status !== null && <Stars value={show.rating} path={`/shows/${show.id}`} />}
      </div>
      {show.overview && <p className="mb-6 text-sm leading-relaxed text-muted">{show.overview}</p>}
      <EpisodeList showId={show.id} episodes={episodes} canEdit />
      <p className="mt-6 text-center text-[11px] text-muted">Données : TMDB · mise à jour {formatDate(new Date().toISOString().slice(0, 10))}</p>
    </article>
  );
}
