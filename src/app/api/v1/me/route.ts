import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { deleteAccount } from "@/lib/account";
import { destroySession, getUser, HttpError, requireUser, verifyPassword } from "@/lib/auth";
import { body, rateLimit, route } from "@/lib/api";

export const GET = route(async () => {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Non connecté");
  return u;
});

/** Suppression définitive du compte et de toutes ses données. Body : {password}. */
export const DELETE = route(async (req) => {
  const user = await requireUser();
  rateLimit(`delete-account:${user.id}`, 5, 15 * 60_000);
  const { password } = await body(req, z.object({ password: z.string().min(1).max(200) }));
  const [row] = await db.execute<{ password_hash: string }>(sql`SELECT password_hash FROM users WHERE id = ${user.id}`);
  if (!row || !(await verifyPassword(password, row.password_hash))) throw new HttpError(401, "Mot de passe incorrect");
  await deleteAccount(user.id);
  await destroySession();
});
