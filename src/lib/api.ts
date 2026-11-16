import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { HttpError } from "./auth";
import { TmdbError } from "./tmdb";

type Ctx<P> = { params: Promise<P> };

/**
 * Enveloppe commune des routes /api/v1 :
 *  - erreurs -> JSON propre (jamais de stack au client)
 *  - anti-CSRF : les écritures exigent du JSON et une Origin identique
 *    (un formulaire d'un autre site ne peut envoyer ni l'un ni l'autre).
 */
export function route<P = Record<string, string>>(fn: (req: NextRequest, params: P) => Promise<Response | unknown>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        if (origin && origin !== req.nextUrl.origin) throw new HttpError(403, "Origine refusée");
        const ct = req.headers.get("content-type") ?? "";
        const hasBody = Number(req.headers.get("content-length") ?? 0) > 0 || req.headers.has("transfer-encoding");
        if (hasBody && !ct.includes("application/json"))
          throw new HttpError(415, "JSON attendu");
      }
      const out = await fn(req, await ctx.params);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Requête invalide", issues: e.issues }, { status: 400 });
      if (e instanceof TmdbError) {
        console.error(e);
        return NextResponse.json({ error: "Catalogue indisponible" }, { status: e.status === 404 ? 404 : 502 });
      }
      console.error(e);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}

export async function body<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const raw = await req.json().catch(() => ({}));
  return schema.parse(raw);
}

export const idParam = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 2_147_483_647) throw new HttpError(400, "id invalide");
  return n;
};

/** Limiteur en mémoire (par instance). En multi-instances : le remplacer par Redis. */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 50_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return;
  }
  if (++b.n > max) throw new HttpError(429, "Trop de tentatives, réessaie plus tard");
}

export const clientIp = (req: NextRequest) =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "local";

export const episodeSelector = z.union([
  z.object({ episodeIds: z.array(z.number().int().positive()).min(1).max(5000) }),
  z.object({ season: z.number().int().min(0).max(1000) }),
  z.object({ upToEpisodeId: z.number().int().positive() }),
  z.object({ all: z.literal(true) }),
]);
