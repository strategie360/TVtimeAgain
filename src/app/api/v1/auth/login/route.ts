import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { createSession, HttpError, verifyPassword } from "@/lib/auth";
import { body, clientIp, rateLimit, route } from "@/lib/api";

const Input = z.object({ email: z.string().trim().max(254), password: z.string().max(200) });
// Hash factice : même coût CPU que l'email existe ou non (pas d'énumération par le temps de réponse).
const DUMMY = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export const POST = route(async (req) => {
  const { email, password } = await body(req, Input);
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60_000);
  rateLimit(`login:${email.toLowerCase()}`, 10, 15 * 60_000);
  const [u] = await db.execute<{ id: number; password_hash: string; display_name: string }>(sql`
    SELECT id, password_hash, display_name FROM users WHERE lower(email) = lower(${email})`);
  const ok = await verifyPassword(password, u?.password_hash ?? DUMMY);
  if (!u || !ok) throw new HttpError(401, "Email ou mot de passe incorrect");
  await createSession(u.id);
  return { id: u.id, displayName: u.display_name };
});
