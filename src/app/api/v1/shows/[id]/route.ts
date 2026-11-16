import { after } from "next/server";
import { z } from "zod";
import { getUser, HttpError, requireUser } from "@/lib/auth";
import { body, idParam, route } from "@/lib/api";
import { ensureShow } from "@/lib/catalog";
import { getShowDetail } from "@/lib/queries";
import { followShow, setShowFlags, unfollowShow } from "@/lib/tracking";

export const GET = route<{ id: string }>(async (_req, p) => {
  const id = idParam(p.id);
  if (!(await ensureShow(id, { background: (pr) => after(pr) }))) throw new HttpError(404, "Série introuvable");
  const user = await getUser();
  return getShowDetail(id, user?.id ?? null);
});

/** Suivre la série. */
export const POST = route<{ id: string }>(async (req, p) => {
  const user = await requireUser();
  const id = idParam(p.id);
  const { status } = await body(req, z.object({ status: z.number().int().min(0).max(3).optional() }));
  if (!(await ensureShow(id))) throw new HttpError(404, "Série introuvable");
  await followShow(user.id, id, status);
});

export const PATCH = route<{ id: string }>(async (req, p) => {
  const user = await requireUser();
  const flags = await body(req, z.object({ status: z.number().int().min(0).max(3).optional(), favorite: z.boolean().optional(), rating: z.number().int().min(1).max(10).nullable().optional() }));
  await setShowFlags(user.id, idParam(p.id), flags);
});

export const DELETE = route<{ id: string }>(async (_req, p) => {
  const user = await requireUser();
  await unfollowShow(user.id, idParam(p.id));
});
