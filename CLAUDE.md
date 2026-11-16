# TVtimeAgain

Application web (PWA) de suivi de séries et de films, qui reprend l'idée de TV Time (fermé faute de
modèle économique viable). Produit public, avec à terme une offre payante pour couvrir les coûts.
Les utilisateurs suivent leurs séries épisode par épisode, voient le calendrier des sorties, notent leurs
films, importent leur historique Letterboxd et reçoivent des recommandations.

Architecture : une application Next.js 15 (App Router) qui sert à la fois les pages (rendu serveur) et une
API JSON `/api/v1`, devant une base Postgres (Drizzle + postgres.js). Le catalogue (séries, épisodes, films)
vient de TMDB, est copié une seule fois et partagé par tous les utilisateurs. Objectif de conception
central : un coût par utilisateur minimal (requêtes en quelques millisecondes, compteurs dénormalisés,
aucun agrégat global à la lecture, images servies par le CDN de TMDB).

Nom public : **RegePlaza** (une seule source : `src/lib/brand.ts`). « TVtimeAgain » est le nom du dépôt.
Éditeur et contact RGPD affichés sur les pages publiques : `src/lib/legal.ts`.

## Layout

- `src/app/(app)/` : pages connectées (à suivre, agenda, séries, films, stats, pour toi, import, sélection rapide, fiches)
- `src/app/login/` : connexion et inscription ; `src/app/about/`, `src/app/privacy/` : pages publiques (TMDB, mentions légales, RGPD)
- `src/app/api/v1/` : API JSON, réutilisable par une future app mobile (route handlers fins)
- `src/lib/` : logique métier et accès aux données
  - `tracking.ts` : écritures utilisateur (épisodes vus, films, notes)
  - `queries.ts` : lectures (une requête par écran)
  - `catalog.ts` / `tmdb.ts` / `sync.ts` : catalogue TMDB, synchro à la demande et job quotidien
  - `imports.ts` / `letterboxd.ts` : import Letterboxd (job reprenable)
  - `recs.ts` : moteur de recommandation
  - `auth.ts` / `api.ts` : sessions, enveloppe des routes API (erreurs, anti-CSRF, rate limit)
  - `account.ts` : export et suppression des données d'un utilisateur (RGPD)
- `src/db/schema.ts` : schéma Drizzle ; `drizzle/` : migrations SQL (dont fonctions SQL écrites à la main)
- `src/components/` : composants React (serveur et client)
- `scripts/` : seed, synchro, graphe de recommandations, évaluation (exécutés avec tsx)
- `public/` : icônes PWA et service worker (`sw.js`)

## Commands

- Run every check (lint, types, tests): `./scripts/check.sh`
- Run one stack only: `./scripts/check.sh --only <stack>`
- Tests : `npm test` (Vitest + Postgres jetable, aucune installation) ; `npm run test:watch` ; tests sans base : `npx vitest run tests/unit`
- Dev server : `npm run dev` (port 3000). Seconde instance isolée pour l'aperçu de Claude : `npm run dev:preview` (port 3001, dossier `.next-preview`)
- Migrations : `npm run db:generate` (après modification de `src/db/schema.ts`), puis `npm run db:migrate`
- Données de dev : `npm run seed` (catalogue fictif) ; `npm run seed -- --bench` (10 000 users, ~2 M épisodes vus)
- Job quotidien : `npm run sync` (synchro TMDB incrémentale + graphe collaboratif)
- Recommandations : `npm run recs:build` (graphe de co-visionnage), `npm run recs:eval` (précision et latence sur le bench),
  `npm run recs:holdout -- <export Letterboxd> [--analyse] [--tuning '{…}']` (mesure sur un vrai historique, base locale :
  à lancer avant de changer l'algorithme ou ses réglages)
- Catalogue : `npm run catalog:backfill-votes` (votes TMDB manquants ; le job quotidien le fait par lots)
- Build : `npm run build` (utiliser `NEXT_DIST_DIR=<dossier>` si un serveur de dev tourne déjà)
- Déploiement : Vercel lance `npm run vercel-build` (migrations de production via `npm run db:migrate:deploy`, puis build) ; voir docs/OPERATIONS.md

## Project-specific rules

- Branches (décision 0004) : branches de travail créées depuis `main`, PR vers `main` ; merger met en production.
  Plus de branche `dev` ni de `release/`. Pour marquer une version : PR `chore(release): <version>` vers `main`
  (CHANGELOG, `package.json`, `package-lock.json`, `docs/STATUS.md`).
- Langue : interface et documentation en français ; code, commits et noms de branches en anglais.
- Variables d'environnement dans `.env.local` (jamais lu ni commité) ; noms et exemples dans `.env.example`.
- Ne jamais lancer deux serveurs Next.js sur le même `distDir` (ça corrompt `.next` et provoque des 404).
- Performance : chaque écran = une requête bornée par `user_id` ; toute écriture met à jour les compteurs
  dénormalisés dans la même transaction. Vérifier les plans avec `EXPLAIN ANALYZE` sur le jeu `--bench`
  avant d'ajouter une requête sur une table utilisateur.
- SQL : toujours paramétré ; tableaux passés via `pgArray()` (un seul paramètre lié) ; caster les constantes
  utilisées dans un `CASE` ou un `UNION` (`::smallint`), sinon Postgres les type en `text`.
- TMDB : ne jamais l'appeler depuis le navigateur ; tout passe par le catalogue partagé. La mention TMDB
  (page À propos) est obligatoire selon leurs conditions.
- Données personnelles : toute nouvelle table liée à un utilisateur doit avoir `ON DELETE CASCADE` depuis
  `users` et apparaître dans l'export (`src/lib/account.ts`), et la page Confidentialité doit rester exacte.
  Mesure d'audience : Vercel Web Analytics (`src/components/analytics.tsx`) ; ne jamais y envoyer de paramètres
  d'URL ni d'identifiant d'utilisateur.
- Hébergement gratuit (Vercel Hobby + Neon Free, décision 0002) : pas d'état en mémoire indispensable
  (plusieurs instances éphémères), requêtes de moins de 300 s, migrations compatibles avec la version
  précédente du code. Aucune API propre à Vercel ou Neon dans le code, pour pouvoir déménager.
- Tests : la logique de `src/lib/` se teste contre la vraie base de test (`tests/helpers/db.ts`), jamais en
  simulant la base ; seul TMDB est simulé. Nouveau fichier de test : `tests/unit/` s'il n'y a pas de base,
  sinon `tests/db/` avec `resetDb()` dans `beforeEach`.
- Hook du template : `npm pkg set …` est bloqué à tort (règle `[secrets]`, le mot `set`) ; modifier
  `package.json` directement.

<!-- dev-template:begin (managed by install.sh, do not edit inside this block) -->
## Engineering standards

These standards are mandatory. Read them before starting any task.
The one-page human summary of every rule and command is docs/WORKFLOW.md; when a hook blocks you, its rule id is explained there.
@.claude/standards/core.md
@.claude/standards/clean-code.md
@.claude/standards/documentation.md
@.claude/standards/web-ts.md

## Current project status

Read before planning any work; keep it current (/status).

@docs/STATUS.md
<!-- dev-template:end -->
