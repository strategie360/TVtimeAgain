# 0003. Intégrer sur une branche `dev` avant `main`

- Status: superseded by [0004](0004-pull-requests-directly-to-main.md)
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
  nécessaire. Après le merge dans `main`, une seconde PR de la même branche `release/<version>` vers `dev`
  y ramène le passage de version (une PR depuis `main` serait refusée par la CI).
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
  pre-commit bloque déjà les commits sur `dev` (nom de branche non conforme). Proposition au template :
  rendre la liste des branches protégées et la branche de base configurables (`.template/config`).
- **Aucune protection côté GitHub** : l'organisation est sur l'offre gratuite et le dépôt est privé ; GitHub
  refuse les règles de protection et les rulesets (« Upgrade to GitHub Pro or make this repository public »,
  vérifié le 2026-11-16). Seuls les hooks locaux protègent `main` et `dev` : un push direct reste possible
  depuis une machine sans les hooks, ou en les contournant volontairement. Choix du 2026-11-16 : les hooks
  locaux suffisent tant qu'une seule personne travaille sur le projet ; à revoir (GitHub Team) dès qu'un
  autre contributeur arrive.
- Incident du 2026-11-16 : une PR directe `dev` → `main` (#9) a été mergée (la CI la refuse, mais rien
  n'est protégé), puis `dev` a été supprimée par le bouton « Delete branch » de GitHub. `dev` a été recréée
  depuis `main`. À retenir : passer par `release/<version>`, et ne jamais supprimer `dev` après un merge.
- `main` reste la branche par défaut sur GitHub : elle représente la production. Les PR de travail doivent
  donc viser `dev` explicitement (`gh pr create --base dev`).
- La CI `web-ts` tourne sur toutes les PR (vers `dev` comme vers `main`), mais pas sur les push vers `dev`.
- Une deuxième base Neon (branche `dev`) consomme une partie des limites gratuites (stockage, CU-heures).
