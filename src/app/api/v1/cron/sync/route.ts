import { HttpError } from "@/lib/auth";
import { route } from "@/lib/api";
import { isAuthorizedCron } from "@/lib/deploy";
import { runDailySync } from "@/lib/sync";

export const maxDuration = 300; // maximum de l'offre Vercel Hobby

/**
 * Job quotidien. Authorization: Bearer $CRON_SECRET.
 * GET : appel de Vercel Cron (vercel.json). POST : cron externe ou appel manuel.
 */
const handler = route(async (req) => {
  if (!isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)) throw new HttpError(401, "Non autorisé");
  return runDailySync();
});

export const GET = handler;
export const POST = handler;
