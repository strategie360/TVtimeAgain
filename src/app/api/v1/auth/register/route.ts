import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { createSession, hashPassword, HttpError } from "@/lib/auth";
import { body, clientIp, rateLimit, route } from "@/lib/api";

const Input = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(50),
});

export const POST = route(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 10, 3600_000);
  const { email, password, displayName } = await body(req, Input);
  const hash = await hashPassword(password);
  const [row] = await db.execute<{ id: number }>(sql`
    INSERT INTO users (email, password_hash, display_name) VALUES (${email}, ${hash}, ${displayName})
    ON CONFLICT DO NOTHING RETURNING id`);
  if (!row) throw new HttpError(409, "Un compte existe déjà avec cet email");
  await createSession(row.id);
  return { id: row.id, displayName };
});
