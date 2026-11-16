"use client";
import { Analytics } from "@vercel/analytics/next";
import { stripQuery } from "@/lib/analytics";

/**
 * Mesure d'audience Vercel Web Analytics : sans cookie, anonyme, pages vues seulement.
 * En local (next dev), le script tourne en mode debug et n'envoie rien.
 */
export function SiteAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: stripQuery(event.url) })} />;
}
