import { HttpError, requireUser } from "@/lib/auth";
import { idParam, route } from "@/lib/api";
import { ensureMovie } from "@/lib/catalog";
import { markMovieWatched, unmarkMovie } from "@/lib/tracking";

export const POST = route<{ id: string }>(async (_req, p) => {
  const user = await requireUser();
  const id = idParam(p.id);
  if (!(await ensureMovie(id))) throw new HttpError(404, "Film introuvable");
  await markMovieWatched(user.id, id);
});

/** Retire le film de la liste (vu ou watchlist). */
export const DELETE = route<{ id: string }>(async (_req, p) => {
  const user = await requireUser();
  await unmarkMovie(user.id, idParam(p.id));
});
