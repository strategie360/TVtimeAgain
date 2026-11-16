import { z } from "zod";
import { HttpError, requireUser } from "@/lib/auth";
import { route } from "@/lib/api";
import { getCalendar } from "@/lib/queries";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD (fenêtre max 92 jours) */
export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = req.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = Day.parse(sp.get("from") ?? today);
  const to = Day.parse(sp.get("to") ?? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
  const span = (Date.parse(to) - Date.parse(from)) / 864e5;
  if (span < 0 || span > 92) throw new HttpError(400, "Fenêtre de 0 à 92 jours");
  return getCalendar(user.id, from, to);
});
