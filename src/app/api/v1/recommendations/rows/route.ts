import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api";
import { recommendRows } from "@/lib/recs";

/** « Pour toi » en rangées. ?kind=movie|show (films par défaut). */
export const GET = route(async (req) => {
  const user = await requireUser();
  const kind = req.nextUrl.searchParams.get("kind") === "show" ? "show" : "movie";
  return recommendRows(user.id, { kind, background: (p) => after(p) });
});
