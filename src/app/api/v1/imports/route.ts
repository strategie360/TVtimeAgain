import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { body, rateLimit, route } from "@/lib/api";
import { createImport, processImport } from "@/lib/imports";

const Row = z.object({
  name: z.string().trim().min(1).max(300),
  year: z.number().int().min(1870).max(2100).nullable(),
  watched: z.boolean(),
  watchedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  rating: z.number().int().min(1).max(10).nullable(),
  plays: z.number().int().min(0).max(999),
});
const Input = z.object({ source: z.literal("letterboxd"), items: z.array(Row).min(1).max(30000) });

/** Le fichier est lu côté navigateur ; on reçoit des lignes déjà normalisées. */
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`import:${user.id}`, 5, 3600_000);
  const { source, items } = await body(req, Input);
  const id = await createImport(user.id, source, items);
  after(() => processImport(id)); // la réponse part tout de suite, le traitement continue
  return { id, total: items.length };
});
