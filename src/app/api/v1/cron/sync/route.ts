import { timingSafeEqual } from "node:crypto";
import { HttpError } from "@/lib/auth";
import { route } from "@/lib/api";
import { runDailySync } from "@/lib/sync";

export const maxDuration = 300;

/** Appelé par un cron externe : Authorization: Bearer $CRON_SECRET */
export const POST = route(async (req) => {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret)))
    throw new HttpError(401, "Non autorisé");
  return runDailySync();
});
