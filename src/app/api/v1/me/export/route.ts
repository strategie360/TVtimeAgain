import { NextResponse } from "next/server";
import { exportUserData } from "@/lib/account";
import { HttpError, requireUser } from "@/lib/auth";
import { rateLimit, route } from "@/lib/api";

/** Téléchargement de toutes ses données (portabilité RGPD). */
export const GET = route(async () => {
  const user = await requireUser();
  rateLimit(`export:${user.id}`, 10, 3600_000);
  const data = await exportUserData(user.id);
  if (!data) throw new HttpError(404, "Compte introuvable");
  const day = data.exportedAt.slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="regeplaza-export-${day}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
});
