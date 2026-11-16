import { HttpError, requireUser } from "@/lib/auth";
import { idParam, route } from "@/lib/api";
import { ensureMovie } from "@/lib/catalog";
import { addMovieToWatchlist } from "@/lib/tracking";

export const POST = route<{ id: string }>(async (_req, p) => {
  const user = await requireUser();
  const id = idParam(p.id);
  if (!(await ensureMovie(id))) throw new HttpError(404, "Film introuvable");
  await addMovieToWatchlist(user.id, id);
});
