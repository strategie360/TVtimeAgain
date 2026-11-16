import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api";
import { recommend } from "@/lib/recs";

/** ?kind=movie|show (optionnel) &limit=30 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const k = req.nextUrl.searchParams.get("kind");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30) || 30;
  return recommend(user.id, {
    kind: k === "movie" || k === "show" ? k : undefined,
    limit,
    background: (p) => after(p),
  });
});
