# Project status

<!--
Single source of truth on where the project stands. Claude reads it at every session start
(it is imported in CLAUDE.md) and updates it with /status and /ship. Humans read it too:
keep it short, factual and current. Rules: .claude/standards/documentation.md
-->

Phase: mvp
Version: 1.0.0
Last updated: 2026-11-16

<!-- Phase is one of: idea | prototype | mvp | beta | production | maintenance -->

## In one paragraph

RegePlaza (dépôt TVtimeAgain) est une application web, installable sur téléphone, pour suivre ses séries et ses films :
cocher les épisodes vus, savoir quel épisode regarder ensuite, voir les prochaines sorties, noter ses films
et consulter ses statistiques. On peut importer son historique Letterboxd ou cocher rapidement ce qu'on a
déjà vu, et l'application propose des films et des séries adaptés à ses goûts. Elle reprend l'idée de
TV Time, qui a fermé faute de financement, avec l'objectif de coûter très peu par utilisateur. La première version publique (1.0.0) est en ligne
depuis le 16 novembre 2026 : https://t-vtime-again.vercel.app

## Current focus

- Sécuriser la production : sauvegarde indépendante de la base, mises à jour de dépendances restantes.
- Étendre les tests aux parties encore non couvertes (API, authentification, synchro TMDB).

## In progress

- Branche `feat/vercel-analytics` : mesure d'audience Vercel Web Analytics, page Confidentialité mise à jour.

## Done recently

- 2026-11-16 : retour de la release 1.0.0 dans `dev` (PR #7).
- 2026-11-16 : **1.0.0 en ligne** (https://t-vtime-again.vercel.app, PR #6) : Vercel Hobby (fonctions à Francfort, `fra1`) et Neon
  (`aws-eu-central-1`) ; migrations appliquées ; Next.js 15.5.29 (faille CVE-2025-66478 corrigée).
- 2026-11-16 : préparation du lancement (PR #5) : nom RegePlaza, pages À propos (mention TMDB) et
  Confidentialité, export et suppression de compte (RGPD), guide utilisateur, phase `mvp`.
- 2026-11-16 : intégration sur `dev` avant `main` (décision 0003, PR #4) ; `main` reste la branche par défaut (production).
- 2026-11-16 : configuration de déploiement gratuit Vercel Hobby + Neon Free (cron, migrations au
  déploiement, build sans base), décision 0002 et OPERATIONS.md (PR #3).
- 2026-11-16 : branche `dev` créée ; les PR vont désormais vers `dev`.
- 2026-11-16 : tests automatisés de la logique centrale (48 tests : épisodes et compteurs, films, import
  Letterboxd, recommandations), mergés dans `main` (PR #1) ; `./scripts/check.sh` et la CI GitHub passent.
- 2026-11-16 : import Letterboxd, sélection rapide « déjà vus », notes en étoiles, recommandations « Pour toi ».
- 2026-11-15 : suivi des séries et épisodes, calendrier, films, statistiques, synchro TMDB, PWA.

## Next

1. Staging : branche Neon `dev` et variables Preview de Vercel limitées à la branche `dev` (docs/OPERATIONS.md).
2. Sauvegarde régulière de la base (`pg_dump` programmé) : Neon Free ne restaure que sur 6 h.
3. Tests restants : routes API (validation, anti-CSRF, droits), authentification, synchro TMDB (`catalog.ts`, `sync.ts`).
4. Maintenance : fixer Node 22 sur Vercel (`engines`), drizzle-orm 0.45, zod 4, Next 16 (failles restantes, voir plus bas).
5. Fonctionnalités : import TV Time et IMDb, notifications de nouveaux épisodes.

## Known issues and risks

- Phase `mvp` : les routes API, l'authentification, la synchro TMDB et l'interface ne sont pas encore testées,
  alors que le standard demande une couverture complète des fonctionnalités.
- Licence TMDB : l'API gratuite est réservée à un usage non commercial ; une licence commerciale est
  nécessaire avant toute monétisation.
- `main` et `dev` ne sont pas protégées sur GitHub (offre gratuite + dépôt privé) : seuls les hooks locaux
  empêchent un push direct. Risque accepté tant que le projet n'a qu'un contributeur (décision 0003).
- Le nom du dépôt « TVtimeAgain » reprend la marque « TV Time » ; le nom public est RegePlaza.
- Dépendances (`npm audit`, 2026-11-16) : plus de faille critique depuis Next.js 15.5.29. Restent, sans
  impact direct identifié : drizzle-orm (noms de tables, usage interne seulement ; correctif en 0.45), zod
  (très grosses listes ; correctif en zod 4), postcss et sharp embarqués dans Next (correctif en Next 16).
- Limitation de débit (rate limit) en mémoire, par instance : moins efficace sur Vercel (instances multiples).
- Hébergement gratuit : Neon Free limité à 1 Go et 100 CU-heures par mois, restauration sur 6 h seulement ;
  Vercel Hobby réservé à un usage non commercial. Changer d'offre avant toute monétisation (décision 0002).

## Open questions

- Modèle économique : contenu de l'offre payante et calendrier. Owner : TODO.
