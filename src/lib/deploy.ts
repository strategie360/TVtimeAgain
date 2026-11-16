/**
 * Règles de déploiement (Vercel + Neon), sans dépendance au framework pour être testables.
 */
import { timingSafeEqual } from "node:crypto";

/**
 * Le job quotidien est déclenché avec `Authorization: Bearer <CRON_SECRET>`.
 * Vercel Cron envoie cet en-tête tout seul quand la variable CRON_SECRET est définie.
 * Comparaison à temps constant ; refus si aucun secret n'est configuré.
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const got = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

type Env = Record<string, string | undefined>;
/** `fatal` : le build doit échouer (production sans base configurée). */
export type MigrationPlan = { run: true; url: string } | { run: false; fatal: boolean; reason: string };

/**
 * Faut-il appliquer les migrations avant le build ?
 *  - sur Vercel, seulement pour la production : un déploiement de prévisualisation (une branche)
 *    ne doit jamais modifier la base de production ;
 *  - avec la connexion directe de Neon (DATABASE_URL_UNPOOLED) quand elle existe : le pooler
 *    (PgBouncer, mode transaction) ne convient pas aux migrations ;
 *  - une production sans base configurée fait échouer le build, plutôt que de mettre en ligne
 *    un site dont toutes les pages connectées sont en erreur.
 */
export function planMigration(env: Env): MigrationPlan {
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") {
    return { run: false, fatal: false, reason: `déploiement « ${env.VERCEL_ENV} » : migrations réservées à la production` };
  }
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!url) {
    return {
      run: false,
      fatal: env.VERCEL_ENV === "production",
      reason: "ni DATABASE_URL_UNPOOLED ni DATABASE_URL n'est défini",
    };
  }
  return { run: true, url };
}
