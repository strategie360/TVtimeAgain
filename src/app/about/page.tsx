import { PublicShell } from "@/components/public-shell";
import { APP_NAME } from "@/lib/brand";
import { PUBLISHER } from "@/lib/legal";

export const metadata = { title: "À propos" };

export default function AboutPage() {
  return (
    <PublicShell title={`À propos de ${APP_NAME}`}>
      <p>
        {APP_NAME} permet de suivre ses séries épisode par épisode, de garder la liste de ses films vus et à voir,
        de voir les prochaines sorties et de recevoir des recommandations.
      </p>

      <h2>Source des données</h2>
      <p>
        Les informations sur les films et les séries (titres, résumés, dates, affiches) proviennent de{" "}
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">The Movie Database (TMDB)</a>.
      </p>
      <p lang="en">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p>Ce produit utilise l&apos;API de TMDB, sans être approuvé ni certifié par TMDB.</p>

      <h2>Mentions légales</h2>
      <ul>
        <li>Éditeur et directeur de la publication : {PUBLISHER.name}, <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a></li>
        <li>Hébergement : Vercel Inc. (application) et Neon Inc. (base de données)</li>
        <li>Projet non commercial.</li>
      </ul>
    </PublicShell>
  );
}
