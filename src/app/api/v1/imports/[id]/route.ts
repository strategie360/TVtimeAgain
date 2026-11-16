import { after } from "next/server";
import { HttpError, requireUser } from "@/lib/auth";
import { idParam, route } from "@/lib/api";
import { getImport, processImport } from "@/lib/imports";

export const GET = route<{ id: string }>(async (_req, p) => {
  const user = await requireUser();
  const imp = await getImport(user.id, idParam(p.id));
  if (!imp) throw new HttpError(404, "Import introuvable");
  // Worker mort (redémarrage, timeout) : on relance, il reprend au dernier lot.
  if (imp.stalled) after(() => processImport(imp.id));
  return imp;
});
