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

- Ajouter des tests automatisés sur la logique centrale (suivi d'épisodes, import, recommandations).
- Mettre l'application en ligne (serveur en Europe, sauvegardes, job quotidien).

## In progress

- None

## Done recently

- 2026-11-16 : import Letterboxd, sélection rapide « déjà vus », notes en étoiles, recommandations « Pour toi ».
- 2026-11-15 : suivi des séries et épisodes, calendrier, films, statistiques, synchro TMDB, PWA.

## Next

1. Tests automatisés (Vitest + base Postgres de test) ; le contrôle du template échoue sans script `test`.
2. Déploiement : Dockerfile, mode `standalone`, migrations au déploiement, job quotidien, sauvegardes.
3. Fonctionnalités : import TV Time et IMDb, notifications de nouveaux épisodes, export et suppression de compte.

## Known issues and risks

- Aucun test automatisé : `./scripts/check.sh` échoue tant qu'il n'y a pas de script `test`.
- Licence TMDB : l'API gratuite est réservée à un usage non commercial ; une licence commerciale est
  nécessaire avant toute monétisation.
- Le nom « TVtimeAgain » reprend la marque « TV Time » : risque juridique pour un produit public.
- Limitation de débit (rate limit) en mémoire, par instance : à déplacer (ex. Redis) si plusieurs instances.

## Open questions

- Nom définitif du produit : l'interface affiche « NextUp », la documentation « TVtimeAgain ». Owner : TODO.
- Hébergement : serveur unique en Europe avec Coolify recommandé, pas encore choisi. Owner : TODO.
- Modèle économique : contenu de l'offre payante et calendrier. Owner : TODO.
