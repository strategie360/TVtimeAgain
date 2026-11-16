import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { ensureShow } from "@/lib/catalog";
import { markEpisodes } from "@/lib/tracking";

/** Sélection rapide : chaque série est marquée entièrement vue (épisodes diffusés). */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { ids } = await body(req, z.object({ ids: z.array(z.number().int().positive()).min(1).max(50) }));
  let episodes = 0;
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 4) {
    await Promise.all(
      uniq.slice(i, i + 4).map(async (id) => {
        if (await ensureShow(id).catch(() => false)) episodes += (await markEpisodes(user.id, id, { all: true })).added;
      }),
    );
  }
  return { shows: uniq.length, episodes };
});
