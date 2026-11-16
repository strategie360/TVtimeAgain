import { after } from "next/server";
import { z } from "zod";
import { getUser, HttpError, requireUser } from "@/lib/auth";
import { body, idParam, route } from "@/lib/api";
import { ensureMovie } from "@/lib/catalog";
import { getMovieDetail } from "@/lib/queries";
import { setMovieRating } from "@/lib/tracking";

export const GET = route<{ id: string }>(async (_req, p) => {
  const id = idParam(p.id);
  if (!(await ensureMovie(id, { background: (pr) => after(pr) }))) throw new HttpError(404, "Film introuvable");
  const user = await getUser();
  return getMovieDetail(id, user?.id ?? null);
});

/** {rating: 1..10 | null} */
export const PATCH = route<{ id: string }>(async (req, p) => {
  const user = await requireUser();
  const id = idParam(p.id);
  const { rating } = await body(req, z.object({ rating: z.number().int().min(1).max(10).nullable() }));
  if (!(await ensureMovie(id))) throw new HttpError(404, "Film introuvable");
  await setMovieRating(user.id, id, rating);
});
