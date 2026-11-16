/**
 * Ce qui part vers Vercel Web Analytics : seulement le chemin de la page.
 * Les paramètres d'URL (texte d'une recherche, ?deleted=1…) et l'ancre sont retirés,
 * pour n'envoyer que le minimum (voir la page Confidentialité).
 */
export function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    // URL relative ou invalide : on coupe à la main.
    return url.split(/[?#]/)[0];
  }
}
