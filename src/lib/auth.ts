/**
 * Auth par session, sans dépendance externe.
 *  - Mot de passe : scrypt (Node crypto), sel aléatoire, comparaison à temps constant.
 *  - Session : token aléatoire de 32 octets dans un cookie httpOnly ; la base ne
 *    stocke que son sha256.
 *  - Glissement : la session est prolongée au plus une fois par jour (pas une
 *    écriture par requête).
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const COOKIE = "session";
const DAY = 24 * 3600 * 1000;
const SESSION_DAYS = 60;

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(pw, Buffer.from(saltB64, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(key, expected);
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.execute(sql`INSERT INTO sessions (id, user_id, expires_at) VALUES (${hashToken(token)}, ${userId}, ${expires.toISOString()})`);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Le cookie vit longtemps ; c'est expires_at en base qui fait foi (et glisse).
    maxAge: 400 * 24 * 3600,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.execute(sql`DELETE FROM sessions WHERE id = ${hashToken(token)}`);
  jar.delete(COOKIE);
}

export type SessionUser = { id: number; displayName: string; email: string };

/** Mis en cache pour la durée d'une requête : 1 seule lecture même si appelé partout. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db.execute<{ user_id: number; display_name: string; email: string; expires_at: Date }>(sql`
    SELECT s.user_id, s.expires_at, u.display_name, u.email
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ${id} AND s.expires_at > now()`);
  if (!row) return null;
  // Prolonge seulement si la session a plus d'un jour d'âge.
  if (new Date(row.expires_at).getTime() - Date.now() < (SESSION_DAYS - 1) * DAY) {
    await db.execute(sql`UPDATE sessions SET expires_at = now() + ${`${SESSION_DAYS} days`}::interval WHERE id = ${id}`);
  }
  return { id: row.user_id, displayName: row.display_name, email: row.email };
});

export async function requireUser() {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Non connecté");
  return u;
}

/** Pour les pages : redirige vers /login au lieu de lever une erreur. */
export async function pageUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
