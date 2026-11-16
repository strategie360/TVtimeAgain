# Project status

<!--
Single source of truth on where the project stands. Claude reads it at every session start
(it is imported in CLAUDE.md) and updates it with /status and /ship. Humans read it too:
keep it short, factual and current. Rules: .claude/standards/documentation.md
-->

Phase: mvp
Version: 0.1.0
Last updated: 2026-11-16

<!-- Phase is one of: idea | prototype | mvp | beta | production | maintenance -->

## In one paragraph

RegePlaza (dépôt TVtimeAgain) est une application web, installable sur téléphone, pour suivre ses séries et ses films :
cocher les épisodes vus, savoir quel épisode regarder ensuite, voir les prochaines sorties, noter ses films
et consulter ses statistiques. On peut importer son historique Letterboxd ou cocher rapidement ce qu'on a
déjà vu, et l'application propose des films et des séries adaptés à ses goûts. Elle reprend l'idée de
TV Time, qui a fermé faute de financement, avec l'objectif de coûter très peu par utilisateur. Elle
fonctionne aujourd'hui sur l'ordinateur du développeur ; la première version publique (1.0.0) est en préparation.

## Current focus

- Mettre la V1 (1.0.0) en ligne gratuitement (Vercel Hobby + Neon Free).
- Étendre les tests aux parties encore non couvertes (API, authentification, synchro TMDB).

## In progress

- Branche `feat/v1-launch` : nom RegePlaza, pages À propos (mention TMDB) et Confidentialité, export et
  suppression de compte (RGPD), guide utilisateur, passage en phase `mvp`.

## Done recently

- 2026-11-16 : intégration sur `dev` avant `main` (décision 0003, PR #4) ; `dev` est la branche par défaut.
- 2026-11-16 : configuration de déploiement gratuit Vercel Hobby + Neon Free (cron, migrations au
  déploiement, build sans base), décision 0002 et OPERATIONS.md (PR #3).
- 2026-11-16 : branche `dev` créée ; les PR vont désormais vers `dev`.
- 2026-11-16 : tests automatisés de la logique centrale (48 tests : épisodes et compteurs, films, import
  Letterboxd, recommandations), mergés dans `main` (PR #1) ; `./scripts/check.sh` et la CI GitHub passent.
- 2026-11-16 : import Letterboxd, sélection rapide « déjà vus », notes en étoiles, recommandations « Pour toi ».
- 2026-11-15 : suivi des séries et épisodes, calendrier, films, statistiques, synchro TMDB, PWA.

## Next

1. Mise en ligne : créer les projets Neon (avec une branche `dev`) et Vercel, renseigner les variables
   (docs/OPERATIONS.md), premier déploiement de `dev` puis de `main` via une branche `release/`.
2. Sauvegarde régulière de la base (`pg_dump` programmé) : Neon Free ne restaure que sur 6 h.
3. Tests restants : routes API (validation, anti-CSRF, droits), authentification, synchro TMDB (`catalog.ts`, `sync.ts`).
4. Fonctionnalités : import TV Time et IMDb, notifications de nouveaux épisodes, export et suppression de compte.

## Known issues and risks

- Phase `mvp` : les routes API, l'authentification, la synchro TMDB et l'interface ne sont pas encore testées,
  alors que le standard demande une couverture complète des fonctionnalités.
- Licence TMDB : l'API gratuite est réservée à un usage non commercial ; une licence commerciale est
  nécessaire avant toute monétisation.
- `main` et `dev` ne sont pas protégées sur GitHub (offre gratuite + dépôt privé) : seuls les hooks locaux
  empêchent un push direct. Risque accepté tant que le projet n'a qu'un contributeur (décision 0003).
- Le nom du dépôt « TVtimeAgain » reprend la marque « TV Time » ; le nom public est RegePlaza.
- Limitation de débit (rate limit) en mémoire, par instance : moins efficace sur Vercel (instances multiples).
- Hébergement gratuit : Neon Free limité à 1 Go et 100 CU-heures par mois, restauration sur 6 h seulement ;
  Vercel Hobby réservé à un usage non commercial. Changer d'offre avant toute monétisation (décision 0002).

## Open questions

- Modèle économique : contenu de l'offre payante et calendrier. Owner : TODO.
