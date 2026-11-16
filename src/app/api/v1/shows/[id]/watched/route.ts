import { HttpError, requireUser } from "@/lib/auth";
import { body, episodeSelector, idParam, route } from "@/lib/api";
import { ensureShow } from "@/lib/catalog";
import { markEpisodes, unmarkEpisodes } from "@/lib/tracking";

/** Body : {episodeIds:[...]} | {season:n} | {upToEpisodeId:id} | {all:true} */
export const POST = route<{ id: string }>(async (req, p) => {
  const user = await requireUser();
  const id = idParam(p.id);
  const sel = await body(req, episodeSelector);
  if (!(await ensureShow(id))) throw new HttpError(404, "Série introuvable");
  return markEpisodes(user.id, id, sel);
});

export const DELETE = route<{ id: string }>(async (req, p) => {
  const user = await requireUser();
  return unmarkEpisodes(user.id, idParam(p.id), await body(req, episodeSelector));
});
