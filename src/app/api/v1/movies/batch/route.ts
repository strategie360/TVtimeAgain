import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { ensureMovie } from "@/lib/catalog";
import { markMoviesWatchedBatch } from "@/lib/tracking";

/** Sélection rapide : {ids:[…]} marqués vus d'un coup. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { ids } = await body(req, z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }));
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 8) await Promise.all(uniq.slice(i, i + 8).map((id) => ensureMovie(id).catch(() => false)));
  return { added: await markMoviesWatchedBatch(user.id, uniq) };
});
