# 0003. Intégrer sur une branche `dev` avant `main`

- Status: accepted
- Date: 2026-11-16

## Context

Jusqu'ici, chaque PR allait directement dans `main`, et chaque merge dans `main` part en production
(Vercel, décision 0002). On veut pouvoir regrouper et essayer plusieurs changements dans un environnement
proche de la production avant de les mettre en ligne.

Le template de développement suppose un flux direct vers `main` :
- la CI (`conventions`) exige que la branche source d'une PR s'appelle `<type>/<description>` : une PR
  dont la source est `dev` est refusée ;
- les commandes `/feature`, `/review` et `/ship` utilisent `main` comme base ;
- seules `main` et `master` sont protégées par les hooks Claude.

## Decision

- `dev` est la branche d'intégration. Toutes les branches de travail partent de `dev` et y reviennent par PR.
- La mise en production passe par une branche `release/<version>` créée depuis `dev`, puis une PR vers
  `main`. Le type `release/` est déjà accepté par la CI du template : aucun changement du template n'est
  nécessaire.
- La preview Vercel de la branche `dev` sert d'environnement de test (« staging »), avec sa propre base
  (une branche Neon `dev`). Les migrations y sont appliquées au déploiement (`planMigration`), comme en
  production.
- La règle « la base est `dev` » est écrite dans `CLAUDE.md`, au-dessus des commandes du template.

## Alternatives considered

- **PR directe `dev` → `main`** : refusée par la CI du template à cause du nom de branche. Il faudrait
  modifier le template (accepter `dev` comme source), pour un gain faible face à une branche `release/`.
- **Rester en direct sur `main`** : plus simple, mais chaque merge part en production sans étape d'essai.

## Consequences

- Une étape de plus pour mettre en production (branche `release/`, PR, merge), mais un vrai environnement
  d'essai avec ses propres données.
- `dev` n'est pas protégée par les hooks Claude du template (seulement `main`/`master`). Le hook git
  pre-commit bloque déjà les commits sur `dev` (nom de branche non conforme) ; il faut en plus protéger `dev`
  sur GitHub (Settings → Branches). Proposition au template : rendre la liste des branches protégées
  et la branche de base configurables (`.template/config`).
- La CI `web-ts` tourne sur toutes les PR (vers `dev` comme vers `main`), mais pas sur les push vers `dev`.
- Une deuxième base Neon (branche `dev`) consomme une partie des limites gratuites (stockage, CU-heures).
