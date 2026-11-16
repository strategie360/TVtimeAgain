import { notFound } from "next/navigation";
import { after } from "next/server";
import { pageUser } from "@/lib/auth";
import { ensureMovie } from "@/lib/catalog";
import { getMovieDetail } from "@/lib/queries";
import { img } from "@/lib/tmdb";
import { MovieControls } from "@/components/actions";
import { Stars } from "@/components/stars";
import { formatDate, Poster } from "@/components/ui";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await pageUser();
  if (!(await ensureMovie(id, { background: (p) => after(p) }))) notFound();
  const m = await getMovieDetail(id, user.id);
  if (!m) notFound();
  const backdrop = img(m.backdrop_path, "w780");
  return (
    <article>
      <div className="relative -mx-4 mb-4 overflow-hidden md:mx-0 md:rounded-2xl">
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="relative flex gap-4 bg-gradient-to-t from-bg via-bg/70 to-transparent p-4 pt-10">
          <Poster path={m.poster_path} alt={m.title} className="w-28 shrink-0 shadow-xl" />
          <div className="flex min-w-0 flex-col justify-end gap-2">
            <h1 className="text-2xl font-bold leading-tight">{m.title}</h1>
            <p className="text-sm text-muted">
              {[formatDate(m.release_date), m.runtime ? `${m.runtime} min` : null].filter(Boolean).join(" · ")}
            </p>
            {m.watched_at && <p className="text-xs text-ok">Vu le {formatDate(m.watched_at.slice(0, 10))}</p>}
          </div>
        </div>
      </div>
      <div className="mb-4 space-y-3">
        <MovieControls movieId={m.id} status={m.user_status} plays={m.plays} />
        <Stars value={m.rating} path={`/movies/${m.id}`} />
      </div>
      {m.overview && <p className="text-sm leading-relaxed text-muted">{m.overview}</p>}
    </article>
  );
}
