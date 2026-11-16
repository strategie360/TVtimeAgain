# Operations

<!-- For whoever deploys and runs the system. A person on call should be able to act from this page alone. -->

Hébergement retenu : Vercel Hobby + Neon Free, tant que le projet n'est pas commercial
([décision 0002](decisions/0002-host-on-vercel-hobby-and-neon-free.md)).

## Environments

| Environment | URL / target | Deployed from | Notes |
|---|---|---|---|
| Local | http://localhost:3000 | `npm run dev` | Postgres local, voir [DEVELOPMENT.md](DEVELOPMENT.md) |
| Staging | URL de la preview de la branche `dev` (adresse stable par branche) | Branche `dev` | Base Neon séparée (branche Neon `dev`), migrée à chaque déploiement ; pas de cron (Vercel ne lance les crons qu'en production) |
| Preview | URL générée par Vercel pour chaque PR | Branches de travail | Pas de migration, pas de base par défaut : les pages connectées y sont en erreur |
| Production | TODO (URL Vercel ou domaine, pas encore créé) | Branche `main` | Vercel Hobby, région `fra1` ; base Neon Free |

## Configuration

Les mêmes variables que `.env.example`. Les valeurs ne sont jamais dans le dépôt.

| Variable | Purpose | Required | Where it is stored |
|---|---|---|---|
| `DATABASE_URL` | Connexion Postgres de l'app. En production : adresse **pooled** de Neon (`…-pooler…`, `?sslmode=require`) | Oui | Local : `.env.local`. Prod : variables d'environnement Vercel (Production) |
| `DATABASE_URL_UNPOOLED` | Adresse **directe** de Neon, utilisée seulement pour les migrations au déploiement | Prod | Vercel (Production) ; fournie par l'intégration Neon si elle est utilisée |
| `DATABASE_POOL_MAX` | Connexions par instance : 10 en local, **3** sur Vercel | Non (défaut 10) | `.env.local` / Vercel |
| `DATABASE_PREPARE` | `false` derrière le pooler Neon (mode transaction), `true` sinon | Prod : `false` | `.env.local` / Vercel |
| `TMDB_TOKEN` | Jeton TMDB « API Read Access Token » (v4) | Oui | `.env.local` / Vercel |
| `TMDB_LANGUAGE` | Langue des métadonnées (`fr-FR`) | Non (défaut `fr-FR`) | `.env.local` / Vercel |
| `CRON_SECRET` | Secret du job quotidien ; Vercel Cron l'envoie tout seul dans `Authorization: Bearer …` | Oui | `.env.local` / Vercel ; une longue chaîne aléatoire |

Variables posées par Vercel et lues par le code : `VERCEL_ENV` et `VERCEL_GIT_COMMIT_REF` (les migrations ne
tournent qu'en production et sur la preview de `dev`, voir `planMigration` dans `src/lib/deploy.ts`).

## Deploy

### Mise en place (une seule fois)

1. **Neon** (https://neon.com) : créer un compte et un projet Postgres, région Europe (Francfort) si
   elle est proposée. Récupérer l'adresse *pooled* et l'adresse *directe*.
2. **Vercel** (https://vercel.com) : créer un compte, importer le dépôt GitHub `strategie360/TVtimeAgain`.
   Le framework Next.js est détecté ; le build utilise le script `vercel-build` de `package.json`.
   Vérifier Settings → Git → **Production Branch = `main`** (c'est la branche par défaut de GitHub,
   que Vercel reprend à l'import).
3. Dans Vercel → Settings → Environment Variables, scope **Production** : `DATABASE_URL` (pooled),
   `DATABASE_URL_UNPOOLED` (directe), `DATABASE_POOL_MAX=3`, `DATABASE_PREPARE=false`, `TMDB_TOKEN`,
   `CRON_SECRET`.
4. **Staging (`dev`)** : dans Neon, créer une branche `dev` à partir de la branche principale (elle a sa
   propre adresse pooled et directe). Dans Vercel, scope **Preview** limité à la branche Git `dev` :
   `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (de la branche Neon `dev`), `DATABASE_POOL_MAX=3`,
   `DATABASE_PREPARE=false`, `TMDB_TOKEN`. Ne jamais y mettre l'adresse de la base de production.
   Les autres previews n'ont pas de base : leur build réussit, mais les pages connectées y sont en erreur.
5. Lancer un premier déploiement (push sur `main`) ; les migrations s'appliquent pendant le build.

### Avant la première mise en ligne publique

Les pages publiques affirment des choses qui doivent être vraies en production :
- La base Neon est bien en **Union européenne (Francfort)**, comme l'indique la page Confidentialité.
  Sinon, corriger `src/app/privacy/page.tsx`.
- Les fonctions Vercel tournent en `fra1` (`vercel.json`).
- Mentions légales (page À propos) : la loi (LCEN) demande aussi l'adresse et le téléphone de l'hébergeur.
  TODO : les ajouter dans `src/app/about/page.tsx` depuis les conditions de Vercel et Neon.
- L'adresse publique est renseignée dans `docs/USER_GUIDE.md` (TODO) et dans la section Environments.

### À chaque mise en production

- Le travail arrive d'abord sur `dev` (déployé en staging), puis passe en production par une branche
  `release/<version>` et une PR vers `main` ([décision 0003](decisions/0003-integrate-on-dev-before-main.md)).
- Merger une PR dans `main` déclenche le déploiement de production. Le build exécute
  `npm run db:migrate:deploy` puis `next build`. Si une migration échoue, ou si aucune adresse de base
  n'est configurée en production, le build échoue et l'ancienne version reste en ligne.
- Le job quotidien (`vercel.json`) appelle `GET /api/v1/cron/sync` à 04:00 UTC (à l'heure près sur
  l'offre Hobby).

### Retour arrière

- Code : Vercel → Deployments → choisir le déploiement précédent → *Promote to Production*
  (ou *Instant Rollback*).
- Base : les migrations ne sont pas annulées automatiquement. Une migration doit donc rester compatible
  avec la version précédente du code (ajouter avant de supprimer). En cas de problème grave :
  restauration Neon à un instant donné (fenêtre de 6 h sur Free), voir Backups.

## Monitoring

- Journaux de l'app et des crons : Vercel → projet → Logs (et Deployments → Cron Jobs).
- Base : tableau de bord Neon (stockage, CU-heures consommées, transfert).
- TODO : suivi des erreurs et alertes (rien n'est en place).

## Runbook

**Le job quotidien ne tourne pas ou renvoie 401**
- Vérifier que `CRON_SECRET` est défini côté Vercel (Production), puis redéployer.
- Lancer le job à la main : `curl -X POST -H "Authorization: Bearer <secret>" https://<prod>/api/v1/cron/sync`.

**Les écritures échouent (inscription, épisodes cochés)**
- Neon Free bloque les écritures au-delà de 1 Go de stockage, et suspend la base si le transfert mensuel
  dépasse 5 Go. Vérifier dans le tableau de bord Neon ; libérer de la place ou passer à l'offre payante.

**La première requête est lente (~1 s)**
- Normal sur Neon Free : la base se met en veille après 5 min d'inactivité.

**Le build échoue sur « échec des migrations »**
- Lire le message dans les logs du build. Corriger la migration sur une branche ; la version précédente
  reste en ligne entre-temps.

## Backups and data

- Neon Free : restauration à un instant donné sur les **6 dernières heures** seulement.
- TODO : sauvegarde régulière indépendante (`pg_dump` programmé vers un stockage externe), pas encore
  en place. C'est le principal risque de cet hébergement gratuit.
- Données personnelles : email, pseudo, historique de visionnage et notes (voir
  [ARCHITECTURE.md](ARCHITECTURE.md#data)).

## Access

TODO : qui a accès aux comptes Vercel, Neon, TMDB et GitHub, et comment demander un accès
(aucun identifiant ici).
