# Development guide

<!-- For a developer joining the project: from a fresh machine to a first merged PR. -->

## Prerequisites

- Node.js ≥ 20.11 (testé avec 20.11.0) et npm (lockfile `package-lock.json`).
- PostgreSQL ≥ 14 (testé avec 14.17, installé via Homebrew sur macOS).
- `jq` (utilisé par le template de développement).
- Un token TMDB « API Read Access Token » (v4) : https://www.themoviedb.org/settings/api.
  Facultatif pour démarrer : `npm run seed` fournit un catalogue fictif.

## Setup

```bash
git clone TODO-url-du-depot tvtimeagain && cd tvtimeagain
npm install
cp .env.example .env.local      # puis renseigner TMDB_TOKEN (et CRON_SECRET)
createdb tvtime
npm run db:migrate
npm run seed                    # catalogue fictif : 2 séries, 2 films
```

Les variables sont décrites dans `.env.example` : `DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_PREPARE`,
`TMDB_TOKEN`, `TMDB_LANGUAGE`, `CRON_SECRET`.

## Run

```bash
npm run dev                     # http://localhost:3000
```

Créer un compte sur la page de connexion, puis chercher une série ou un film en haut de l'écran.

Autres commandes utiles :

| Commande | Effet |
|---|---|
| `npm run seed -- --bench` | Ajoute 10 000 utilisateurs fictifs et ~2 M épisodes vus, pour mesurer les requêtes |
| `npm run sync` | Synchro TMDB incrémentale + recalcul du graphe de recommandations (job quotidien) |
| `npm run recs:build` | Recalcule seulement le graphe de co-visionnage |
| `npm run recs:eval` | Mesure la précision et la latence des recommandations (nécessite `--bench`) |
| `npm run db:generate` | Génère une migration après une modification de `src/db/schema.ts` |
| `npm run dev:preview` | Seconde instance isolée (port 3001, dossier `.next-preview`) |

## Test and check

```bash
./scripts/check.sh            # lint, types and tests for every stack
./scripts/check.sh --only <stack>
```

```bash
npm test                      # toute la suite (Vitest), ~10 s
npm run test:watch            # relance les tests à chaque modification
npx vitest run tests/unit     # uniquement les tests sans base de données
```

Les tests n'ont besoin d'aucune installation : `tests/global-setup.ts` démarre un vrai Postgres jetable
(embedded-postgres) sur un port libre, y applique les migrations de `drizzle/`, puis le supprime à la fin.
Ça marche à l'identique en local et en CI. Pour aller plus vite en local, on peut pointer
`TEST_DATABASE_URL` vers une base existante, **qui sera vidée** (par exemple `createdb tvtime_test`).

| Dossier | Contenu |
|---|---|
| `tests/unit/` | Logique pure : lecture des exports Letterboxd, choix du bon film TMDB |
| `tests/db/` | Logique avec base : épisodes vus et compteurs, films, import Letterboxd, recommandations |
| `tests/helpers/db.ts` | Remise à zéro de la base et création de données de test (`createShow`, `createMovie`…) |

Le réseau n'est jamais appelé : TMDB est simulé avec `vi.mock("@/lib/tmdb", …)` ou `vi.stubGlobal("fetch", …)`.
Les fichiers de test partagent la même base et s'exécutent donc l'un après l'autre.

Pour vérifier une requête, la lancer avec `EXPLAIN ANALYZE` dans `psql -d tvtime` sur le jeu `--bench`.

## Workflow

The full summary of rules and commands is in [WORKFLOW.md](WORKFLOW.md). In short:

- Branch from `main`: `<type>/<short-description>` (feat, fix, chore, docs, refactor, test…).
- Conventional Commits; tests with every change; PR to `main` with the PR template filled in.
- Update [STATUS.md](STATUS.md), [CHANGELOG.md](../CHANGELOG.md) and the docs your change affects.
- Engineering standards: `.claude/standards/` (they apply to humans too).

## Troubleshooting

| Problème | Cause | Solution |
|---|---|---|
| Pages en 404 (`/calendar`, `/library`…) alors qu'elles existent | Deux serveurs Next.js partagent le dossier `.next` | Arrêter les serveurs, puis `rm -rf .next && npm run dev` ; utiliser `npm run dev:preview` pour une 2e instance |
| `ERR_REQUIRE_ESM` sur `magic-string` au démarrage | Version de Tailwind trop récente pour Node 20.11 | Garder `tailwindcss` et `@tailwindcss/postcss` en 4.1.13 |
| « Catalogue indisponible » / recherche vide | `TMDB_TOKEN` absent ou invalide | Vérifier `.env.local`, ou utiliser `npm run seed` |
| `column "…" is of type smallint but expression is of type text` | Constante non typée dans un `CASE`/`UNION` | Ajouter un cast `::smallint` |
| `DATABASE_URL manquant` | Fichier `.env.local` absent | `cp .env.example .env.local` |
