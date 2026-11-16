import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { APP_NAME } from "@/lib/brand";
import { LEGAL_UPDATED_AT, PUBLISHER } from "@/lib/legal";

export const metadata = { title: "Confidentialité" };

export default function PrivacyPage() {
  const mail = <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a>;
  return (
    <PublicShell title="Confidentialité et données personnelles">
      <p className="text-muted">Dernière mise à jour : {LEGAL_UPDATED_AT}</p>

      <h2>Qui est responsable de tes données ?</h2>
      <p>{PUBLISHER.name}, éditeur de {APP_NAME}. Contact : {mail}.</p>

      <h2>Quelles données, et pourquoi ?</h2>
      <ul>
        <li><b>Compte</b> : adresse email, pseudo et mot de passe (stocké chiffré de façon irréversible, jamais en clair). Pour te connecter.</li>
        <li><b>Suivi</b> : séries et films suivis, épisodes vus et leurs dates, notes, favoris, listes « à voir ». C&apos;est le service lui-même.</li>
        <li><b>Imports</b> : titres, années, dates et notes contenus dans un export Letterboxd que tu choisis d&apos;importer.</li>
        <li><b>Recommandations</b> : les titres que tu marques « pas pour moi ».</li>
      </ul>
      <p>
        Ces données servent uniquement à faire fonctionner {APP_NAME} (base légale : exécution du service que tu
        demandes en créant un compte). Elles ne sont ni vendues, ni utilisées pour de la publicité. Ton historique
        sert aussi, sans ton identité, à calculer les titres souvent vus ensemble pour améliorer les recommandations
        de tous.
      </p>

      <h2>Cookies et stockage</h2>
      <p>
        Un seul cookie, indispensable : ta session de connexion. Pas de cookie publicitaire, pas d&apos;outil de
        mesure d&apos;audience. L&apos;application peut garder une copie des pages et des affiches sur ton appareil
        pour fonctionner hors ligne ; elle est effacée à la déconnexion.
      </p>

      <h2>Où sont-elles hébergées ?</h2>
      <p>
        L&apos;application est hébergée par Vercel Inc. et la base de données par Neon Inc., dans l&apos;Union
        européenne (Francfort). Ce sont des sociétés américaines, qui agissent comme sous-traitants. Les informations
        sur les films viennent de TMDB : aucune donnée personnelle ne lui est transmise.
      </p>

      <h2>Combien de temps ?</h2>
      <p>
        Tant que ton compte existe. Une session de connexion expire après 60 jours sans activité. Quand tu supprimes
        ton compte, toutes tes données sont effacées immédiatement ; les sauvegardes techniques de l&apos;hébergeur
        sont écrasées dans les jours qui suivent.
      </p>

      <h2>Tes droits</h2>
      <ul>
        <li><b>Récupérer tes données</b> (portabilité) : bouton « Télécharger mes données » dans <Link href="/account">Mon compte</Link>.</li>
        <li><b>Tout supprimer</b> (effacement) : bouton « Supprimer mon compte » dans <Link href="/account">Mon compte</Link>.</li>
        <li><b>Accès, rectification, opposition, questions</b> : écris à {mail}.</li>
        <li>
          Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL :{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">cnil.fr</a>.
        </li>
      </ul>
    </PublicShell>
  );
}
