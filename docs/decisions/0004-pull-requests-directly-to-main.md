# 0004. Revenir aux PR directes vers `main`

- Status: accepted
- Date: 2026-11-16
- Remplace : [0003](0003-integrate-on-dev-before-main.md)

## Context

La décision 0003 faisait passer chaque changement par une branche `dev`, puis par une branche
`release/<version>` vers `main`. En pratique, sur une seule journée :
- il fallait trois PR pour une mise en production (travail → `dev`, `release/` → `main`, retour vers `dev`) ;
- une PR directe `dev` → `main` a été mergée (#9), puis `dev` supprimée par le bouton « Delete branch » ;
- l'environnement de staging prévu (preview de `dev` avec sa propre base Neon) n'a jamais été configuré.

Le projet n'a qu'un contributeur, et chaque PR a déjà sa propre preview Vercel.

## Decision

- Les branches de travail (`feat/`, `fix/`, `docs/`…) partent de `main` et y reviennent par PR, comme le prévoit
  le template. Merger dans `main` met en production.
- Plus de branche `dev` ni de branches `release/`. Les changements visibles s'ajoutent sous `[Unreleased]` dans
  `CHANGELOG.md` ; pour marquer une version, une PR `chore(release): <version>` vers `main` met à jour
  `CHANGELOG.md`, `package.json`, `package-lock.json` et `docs/STATUS.md`.
- La dernière intégration `dev` → `main` se fait par la release 1.0.1.

## Alternatives considered

- **Garder `dev` (0003)** : plus de sécurité en théorie, mais trois PR par mise en production et un staging jamais
  mis en place ; l'incident de #9 montre que le flux n'était pas tenu.

## Consequences

- Une PR mergée part en production : les contrôles (`./scripts/check.sh`, CI) et la preview de la PR sont la
  seule étape de vérification. Les migrations doivent rester compatibles avec la version précédente du code.
- `planMigration` (`src/lib/deploy.ts`) sait encore migrer une preview de la branche `dev` ; sans branche `dev`,
  cette règle ne sert plus. À retirer lors d'un prochain passage sur ce fichier.
- La branche `dev` peut être supprimée sur GitHub après la release 1.0.1 ; c'est au propriétaire de le faire.
- La règle projet de `CLAUDE.md` qui remplaçait `main` par `dev` est retirée : les commandes du template
  (`/feature`, `/review`, `/ship`) s'appliquent telles quelles.
