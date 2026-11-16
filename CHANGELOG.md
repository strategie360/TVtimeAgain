# Changelog

All notable changes to this project are documented here, for humans.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Bouton pour afficher ou masquer le mot de passe (connexion, inscription, suppression de compte).

## [1.0.1] - 2026-11-16

### Added

- Mesure d'audience anonyme et sans cookie (Vercel Web Analytics), annoncée dans la page Confidentialité.
- Import Letterboxd : les mini-séries de l'export (Chernobyl, Loki…) sont reconnues comme des séries et
  proposées à la fin de l'import, au lieu d'être importées comme de faux films.

### Fixed

- Import Letterboxd : les entrées supprimées (`deleted/`) ou orphelines de l'export ne peuvent plus remplacer
  le vrai journal (dates de visionnage et revisionnages).
- Import Letterboxd : un film n'est plus associé à un titre qui contient seulement le sien (« Loki » ne
  devient plus un court-métrage des Simpson), et les titres très longs sont retrouvés.

## [1.0.0] - 2026-11-16

Première version publique.

### Added

- Suivi des séries épisode par épisode, avec le prochain épisode à regarder et la progression.
- Calendrier des prochaines sorties des séries suivies.
- Suivi des films (vus, à voir, revisionnages) et statistiques de temps passé.
- Recherche de séries et de films (données TMDB).
- Import de l'historique Letterboxd (films vus, notes, dates, watchlist).
- Sélection rapide des films et séries déjà vus.
- Notes en étoiles (demi-étoiles comprises) sur les films et les séries.
- Recommandations personnalisées de films et de séries, avec leur explication.
- Installation sur téléphone comme une application (PWA).
- L'application s'appelle désormais RegePlaza.
- Page « Mon compte » : télécharger toutes ses données et supprimer définitivement son compte.
- Pages « À propos » (source des données TMDB, mentions légales) et « Confidentialité » (données collectées, droits).

### Security

- Next.js mis à jour en 15.5.29 et React en 19.1.10 : correction de la faille critique CVE-2025-66478.
