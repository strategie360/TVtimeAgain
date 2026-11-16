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

/** Branche d'intégration : sa preview Vercel sert d'environnement de test, avec sa propre base. */
export const STAGING_BRANCH = "dev";

/**
 * Faut-il appliquer les migrations avant le build ?
 *  - sur Vercel, en production (`main`) et sur la preview de la branche `dev` (staging, base Neon
 *    séparée). Jamais depuis la preview d'une branche de fonctionnalité : sa base n'est pas la sienne ;
 *  - avec la connexion directe de Neon (DATABASE_URL_UNPOOLED) quand elle existe : le pooler
 *    (PgBouncer, mode transaction) ne convient pas aux migrations ;
 *  - la production ou le staging sans base configurée font échouer le build, plutôt que de mettre en
 *    ligne un site dont toutes les pages connectées sont en erreur.
 */
export function planMigration(env: Env): MigrationPlan {
  const isStaging = env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === STAGING_BRANCH;
  const target = env.VERCEL_ENV === "production" ? "production" : isStaging ? "staging" : null;
  if (env.VERCEL_ENV && !target) {
    const branch = env.VERCEL_GIT_COMMIT_REF ? ` (${env.VERCEL_GIT_COMMIT_REF})` : "";
    return {
      run: false,
      fatal: false,
      reason: `déploiement « ${env.VERCEL_ENV} »${branch} : migrations réservées à la production et à ${STAGING_BRANCH}`,
    };
  }
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (!url) {
    return { run: false, fatal: target !== null, reason: "ni DATABASE_URL_UNPOOLED ni DATABASE_URL n'est défini" };
  }
  return { run: true, url };
}
