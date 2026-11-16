import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { body, route } from "@/lib/api";
import { dismiss } from "@/lib/recs";

export const POST = route(async (req) => {
  const user = await requireUser();
  const { kind, id } = await body(req, z.object({ kind: z.enum(["movie", "show"]), id: z.number().int().positive() }));
  await dismiss(user.id, kind, id);
});
