# 0002. Héberger sur Vercel Hobby et Neon Free tant que le projet n'est pas commercial

- Status: accepted
- Date: 2026-11-16

## Context

Le projet démarre (phase `prototype`), sans revenus et sans usage commercial pour l'instant.
L'objectif de départ du produit est un coût par utilisateur minimal : c'est le coût du service gratuit
qui a fait fermer TV Time. Il faut une mise en ligne à coût nul ou quasi nul, avec un chemin clair vers
un hébergement payant le jour où l'usage devient commercial.

Tarifs relevés le 2026-11-16 (HT) :

| Option | Coût mensuel |
|---|---|
| Scaleway Managed PostgreSQL, DB-DEV-S (2 vCPU, 2 Go), Paris | ~11,40 € (0,0156 €/h) + stockage ~0,10 €/Go, sans compter le serveur de l'app |
| Scaleway Managed PostgreSQL, gamme production (DB-POP2-2C-8G) | ~105 € (0,1434 €/h) |
| Hetzner Cloud CX23 (2 vCPU, 4 Go), app + base sur le même serveur | 5,99 €, affiché « actuellement indisponible » |
| Vercel Hobby (app) + Neon Free (base) | 0 € |

Limites gratuites lues sur les sites le même jour :
- Neon Free : 1 Go de stockage par projet, 100 CU-heures par mois, mise en veille après 5 min
  d'inactivité (reprise en quelques centaines de ms), 5 Go de transfert par mois, restauration
  à un instant donné sur 6 h.
- Vercel Hobby : 1 M d'invocations, 100 Go de bande passante par mois, 300 s maximum par
  fonction, cron une fois par jour maximum (précision à l'heure près).

## Decision

Tant que le projet n'est pas commercial :
- l'application est déployée sur **Vercel Hobby**, en région `fra1` (Francfort) ;
- la base est un projet **Neon Free**, en Europe si la région est disponible à la création (Francfort) ;
- les migrations sont appliquées au déploiement de production (`vercel-build`), jamais depuis un
  déploiement de prévisualisation ;
- le job quotidien passe par Vercel Cron (`vercel.json`, 04:00 UTC).

Le code reste un projet Next.js + Postgres standard, sans API propre à Vercel ou à Neon, pour pouvoir
déménager sans réécriture.

## Alternatives considered

- **Scaleway (Paris)** : hébergeur français, mais ~12 € par mois minimum pour la seule base, plus le serveur.
  Trop cher pour un projet sans revenus. Reste une option pour la phase commerciale.
- **Petit serveur Hetzner avec Coolify** : ~6 € par mois, et c'est ce qui colle le mieux à l'architecture
  (pas de mise en veille, état en mémoire partagé). Mais il demande de l'entretien (mises à jour,
  sauvegardes), et les petites offres sont indisponibles à la date de la décision.
- **Supabase, Render, Railway en gratuit** : non étudiés en détail ; Neon est du Postgres standard
  et se branche sans changement de code.

## Consequences

- Coût nul, mais des limites à surveiller : stockage de 1 Go et 100 CU-heures par mois chez Neon.
  Les écritures sont bloquées si le stockage dépasse 1 Go.
- **Usage non commercial uniquement** sur Vercel Hobby, d'après ses conditions (texte exact à vérifier).
  Le jour où le projet devient commercial (abonnement, publicité), il faut changer d'offre ou d'hébergeur,
  et obtenir la licence commerciale TMDB.
- L'application tourne sur plusieurs instances éphémères : la limitation de débit et la déduplication
  des synchros TMDB, gardées en mémoire, protègent moins. Le verrou dans la base continue de protéger
  la synchro d'une série. Acceptable avec peu d'utilisateurs.
- Restauration à un instant donné limitée à 6 h sur Neon Free : une sauvegarde régulière indépendante
  (`pg_dump`) reste à mettre en place.
- Chemin de sortie : `pg_dump` / `pg_restore` vers la nouvelle base, puis déploiement du même code
  (Vercel Pro + Neon Launch, un serveur, ou Scaleway). À revoir dans un nouvel ADR le moment venu.
