# Project status

<!--
Single source of truth on where the project stands. Claude reads it at every session start
(it is imported in CLAUDE.md) and updates it with /status and /ship. Humans read it too:
keep it short, factual and current. Rules: .claude/standards/documentation.md
-->

Phase: prototype
Version: 0.1.0
Last updated: 2026-11-16

<!-- Phase is one of: idea | prototype | mvp | beta | production | maintenance -->

## In one paragraph

TVtimeAgain est une application web, installable sur téléphone, pour suivre ses séries et ses films :
cocher les épisodes vus, savoir quel épisode regarder ensuite, voir les prochaines sorties, noter ses films
et consulter ses statistiques. On peut importer son historique Letterboxd ou cocher rapidement ce qu'on a
déjà vu, et l'application propose des films et des séries adaptés à ses goûts. Elle reprend l'idée de
TV Time, qui a fermé faute de financement, avec l'objectif de coûter très peu par utilisateur. Elle
fonctionne aujourd'hui sur l'ordinateur du développeur ; elle n'est pas encore en ligne.

## Current focus

- Mettre l'application en ligne (serveur en Europe, sauvegardes, job quotidien).
- Étendre les tests aux parties encore non couvertes (API, authentification, synchro TMDB).

## In progress

- Branche `test/core-logic-tests` : premiers tests automatisés (48 tests, Vitest + Postgres jetable).

## Done recently

- 2026-11-16 : tests automatisés de la logique centrale (épisodes et compteurs, films, import Letterboxd,
  recommandations) ; `./scripts/check.sh` passe.
- 2026-11-16 : import Letterboxd, sélection rapide « déjà vus », notes en étoiles, recommandations « Pour toi ».
- 2026-11-15 : suivi des séries et épisodes, calendrier, films, statistiques, synchro TMDB, PWA.

## Next

1. Déploiement : Dockerfile, mode `standalone`, migrations au déploiement, job quotidien, sauvegardes.
2. Tests restants : routes API (validation, anti-CSRF, droits), authentification, synchro TMDB (`catalog.ts`, `sync.ts`).
3. Fonctionnalités : import TV Time et IMDb, notifications de nouveaux épisodes, export et suppression de compte.

## Known issues and risks

- Tests partiels : les routes API, l'authentification, la synchro TMDB et l'interface ne sont pas encore testées.
- Licence TMDB : l'API gratuite est réservée à un usage non commercial ; une licence commerciale est
  nécessaire avant toute monétisation.
- Le nom « TVtimeAgain » reprend la marque « TV Time » : risque juridique pour un produit public.
- Limitation de débit (rate limit) en mémoire, par instance : à déplacer (ex. Redis) si plusieurs instances.

## Open questions

- Nom définitif du produit : l'interface affiche « NextUp », la documentation « TVtimeAgain ». Owner : TODO.
- Hébergement : serveur unique en Europe avec Coolify recommandé, pas encore choisi. Owner : TODO.
- Modèle économique : contenu de l'offre payante et calendrier. Owner : TODO.
