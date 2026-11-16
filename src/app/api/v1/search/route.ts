import { NextResponse } from "next/server";
import { HttpError } from "@/lib/auth";
import { route } from "@/lib/api";
import { searchMulti } from "@/lib/tmdb";

// Résultats identiques pour tout le monde => cacheables au CDN.
export const GET = route(async (req) => {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) throw new HttpError(400, "Requête trop courte");
  const results = await searchMulti(q.slice(0, 100));
  return NextResponse.json(
    results.slice(0, 20).map((r) => ({
      id: r.id,
      type: r.media_type,
      title: r.name ?? r.title,
      year: (r.first_air_date ?? r.release_date ?? "").slice(0, 4) || null,
      poster_path: r.poster_path,
    })),
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
});
