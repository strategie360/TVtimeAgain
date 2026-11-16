# TVtimeAgain — suivi de séries et de films

Application web (PWA) pour suivre ses séries épisode par épisode et ses films, ouverte à tous.
Elle reprend l'idée de TV Time, pensée dès le départ pour **coûter peu par utilisateur**,
puisque c'est le coût du service gratuit qui a tué l'original.

PWA Next.js 15 · Postgres · Drizzle · données TMDB. (L'interface affiche encore le nom « NextUp ».)

**Status:** see [docs/STATUS.md](docs/STATUS.md). **How we work:** see [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Quick start

Prérequis : Node.js ≥ 20.11, PostgreSQL ≥ 14 (détails dans [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)).

```bash
npm install
cp .env.example .env.local      # puis renseigner TMDB_TOKEN
createdb tvtime
npm run db:migrate
npm run seed                    # catalogue fictif, utilisable sans clé TMDB
npm run dev                     # http://localhost:3000
./scripts/check.sh              # lint, types et tests
```

## Documentation

See [docs/README.md](docs/README.md) for which document to read: status, user guide, development,
architecture, operations, decisions, and the [changelog](CHANGELOG.md).

## Commandes

- `npm run seed -- --bench` : 10 000 users, 180 000 épisodes, 2,4 M épisodes vus (pour `EXPLAIN ANALYZE`)
- `npm run recs:build` : recalcule le graphe de co-visionnage (fait aussi par `npm run sync`)
- `npm run recs:eval` : précision et latence des recommandations sur le jeu `--bench`
- `npm run sync` : job de synchro incrémentale TMDB (à lancer une fois par jour en cron, ou `POST /api/v1/cron/sync` avec `Authorization: Bearer $CRON_SECRET`)

## Architecture

```
Navigateur (PWA) ──► Next.js (pages serveur + /api/v1) ──► Postgres
                                 │
                                 └──► TMDB (uniquement pour remplir le catalogue)
Images : directement depuis le CDN TMDB (0 octet servi par nous)
```

### 1. Le catalogue est partagé, jamais par utilisateur

- `shows`, `episodes`, `movies` utilisent les **IDs TMDB** comme clés primaires (pas de table de correspondance).
- Un titre est récupéré **la première fois qu'un utilisateur l'ouvre**, puis il sert à tout le monde.
  Les ouvertures simultanées sont dédupliquées (Map en mémoire + `pg_advisory_xact_lock` entre instances).
- Une série de 19 saisons coûte **2 requêtes TMDB** (`append_to_response=season/1,…`), pas 20.
- Épisodes : **un seul `INSERT … SELECT FROM unnest(...)`** par série, avec `WHERE … IS DISTINCT FROM`
  pour ne pas réécrire les lignes inchangées (sinon la table gonfle à chaque synchro).
- Rafraîchissement : le job quotidien lit `/tv/changes` et `/movie/changes`, garde **uniquement les titres
  présents chez nous**, et ne resynchronise que ceux-là. Le coût suit ce qui change, pas la taille du catalogue.
- Données de plus de 7 jours : servies immédiatement, rafraîchies en arrière-plan (`after()`), sans bloquer l'utilisateur.

### 2. Les tables utilisateur sont étroites

| Table | Clé | Pourquoi |
|---|---|---|
| `watched_episodes` | `(user_id, show_id, episode_id)` en int4 | LA table qui grossit. ~112 octets/ligne index compris. La PK sert à « ce que l'user a vu » et « ce qu'il a vu de cette série ». Pas de FK vers `episodes` (on économise un contrôle à chaque insert). |
| `user_shows` | `(user_id, show_id)` | Porte la progression **dénormalisée** : `watched_count`, `next_episode_id`, `last_watched_at`. |
| `users` | int4 identity | Les compteurs de stats (`episodes_watched`, `episode_minutes`…) sont maintenus à l'écriture. |
| `sessions` | sha256 du token | Un dump de la base ne permet pas de voler une session. |

Les statuts sont des `smallint`, pas du texte.

### 3. Une écriture = une transaction de 2 ou 3 requêtes, quelle que soit sa taille

Cocher une saison entière (`POST /shows/:id/watched {"season":2}`) fait :
1. une seule requête CTE : `INSERT … SELECT … ON CONFLICT DO NOTHING RETURNING` → agrégat → upsert `user_shows` → `UPDATE users` ;
2. le recalcul de `next_episode_id` (fonction SQL `next_episode_id()`, qui fait 2 lectures d'index) ;
3. la mise à jour du statut (« terminée » si l'utilisateur est à jour et que la série est finie).

C'est idempotent : recocher ne double ni les lignes ni les compteurs.

### 4. Une lecture = une requête, sans agrégat global

Mesuré sur le jeu `--bench` (2,4 M épisodes vus, Postgres 14 sur un portable) :

| Écran | Requête | Temps |
|---|---|---|
| À suivre | join sur `next_episode_id` dénormalisé | 1,2 ms |
| Calendrier 60 j | range scan `(show_id, air_date)` par série suivie | 1,8 ms |
| Fiche série + cases cochées | LEFT JOIN sur la PK | 0,1 ms |
| Stats (12 mois) | bornée à un user via le préfixe de PK | 4,7 ms |
| Cocher une saison | INSERT … SELECT | 0,9 ms |

### 5. Côté client

- Pages rendues côté serveur : pas de cascade de requêtes depuis le navigateur. Environ 105 kB de JS par page.
- Cases à cocher **optimistes** (`useOptimistic`) : l'interface réagit tout de suite.
- Service worker : images TMDB et assets en cache-first (images plafonnées à 400 entrées),
  pages en network-first avec repli hors ligne ; le cache des pages est vidé à la déconnexion.
- `Cache-Control: public, s-maxage` sur la recherche (identique pour tous, donc cacheable au CDN),
  `private, no-store` sur toutes les données utilisateur.

### Sécurité

Mots de passe en scrypt, comparaison à temps constant, hash factice quand l'email n'existe pas (on ne peut pas
deviner les comptes au temps de réponse). Les écritures exigent du JSON et une Origin identique (anti-CSRF).
Rate limit sur l'inscription et la connexion. Tout le SQL est paramétré.

## API (`/api/v1`, JSON) : réutilisable telle quelle par une future app native

| Méthode | Route | Corps |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | `{email, password, displayName?}` |
| GET | `/me`, `/up-next`, `/library`, `/stats`, `/movies` | |
| GET | `/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` | fenêtre de 92 jours maximum |
| GET | `/search?q=` | |
| GET/POST/PATCH/DELETE | `/shows/:id` | POST `{status?}` = suivre ; PATCH `{status?, favorite?}` |
| POST/DELETE | `/shows/:id/watched` | `{episodeIds:[…]}` \| `{season:n}` \| `{upToEpisodeId:id}` \| `{all:true}` |
| GET | `/movies/:id` | |
| POST/DELETE | `/movies/:id/watched` | POST deux fois = revisionnage |
| POST | `/movies/:id/watchlist` | |

## Ajouter beaucoup de films d'un coup

- **Import Letterboxd** (`/import`) : l'utilisateur choisit le `.zip` exporté par Letterboxd.
  Il est lu **dans le navigateur** (fflate) ; seules des lignes compactes partent au serveur.
  `watched.csv`, `diary.csv` (dates, revisionnages), `ratings.csv` (notes, demi-étoiles → 1..10)
  et `watchlist.csv` sont fusionnés par titre|année.
- **Job reprenable** : les lignes sont stockées (`import_items`), puis traitées par lots de 100 avec un
  bail (`lease_until`). Si le serveur redémarre, le prochain affichage de la progression relance le
  traitement là où il s'était arrêté.
- **Correspondance avec TMDB** : recherche en anglais avec et sans l'année, puis on note chaque
  candidat : titre exact, écart d'année, nombre de votes, pénalité pour les making-of. Testé sur des
  remakes (Dune 1984/2021, The Thing 1982/2011). Sous un certain seuil, le titre est déclaré
  « introuvable » plutôt que mal associé.
- **Cache partagé** `letterboxd_matches` : un film n'est cherché chez TMDB qu'une fois, pour
  tous les utilisateurs. Le coût d'un import baisse avec le nombre d'utilisateurs.
- **Sélection rapide** (`/quick`) : une grille des films/séries les plus vus ; on touche les affiches,
  et on valide tout en une requête.

## Recommandations (`/discover`, `GET /api/v1/recommendations?kind=movie|show`)

`score = CF × qualité × affinité de genres`, puis re-classement pour la diversité (voir `src/lib/recs.ts`).

1. **Graines** : tout ce que l'utilisateur a vu, noté, mis en liste ou abandonné, avec un poids dans [-1, 1]
   (note centrée, engagement sur les séries, favori, décroissance temporelle).
   Un titre détesté **repousse** ses voisins.
2. **Filtrage collaboratif item-item** sur un graphe partagé `item_links` :
   - liens TMDB (`/recommendations`), récupérés une fois par titre pour tout le monde ;
   - liens calculés sur **nos** utilisateurs (cosinus de co-visionnage, job de nuit, poids ×1,5).
     Ils peuvent relier un film à une série.
3. **Qualité** : moyenne bayésienne de la note TMDB.
4. **Affinité de genres**, avec correspondance des genres films ↔ séries de TMDB.
5. **Diversité** : on pénalise plusieurs titres issus de la même graine ou du même genre.
6. **Démarrage à froid** : titres les plus votés de ses genres préférés, puis les incontournables.
7. Chaque suggestion est **expliquée** (« Parce que tu as aimé X »). « Pas pour moi » l'exclut ensuite.

Mesures (`npm run recs:eval`, 10 000 users en familles de goûts, 2,2 M épisodes vus) :
précision@10 = **100 %** (hasard : 2 %), latence **8 ms en médiane, 15 ms au p95**.
Le calcul du graphe collaboratif prend 2,2 s. Il tient dans Postgres jusqu'à ~100 k utilisateurs actifs ;
au-delà, le même calcul passe dans un job batch dédié qui réécrit `item_links`.

## Hébergement

Gratuit tant que le projet n'est pas commercial : **Vercel Hobby** pour l'app et **Neon Free** pour la base
([décision 0002](docs/decisions/0002-host-on-vercel-hobby-and-neon-free.md)). Mise en place, variables,
retour arrière et incidents : [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Passer à l'échelle (dans l'ordre, quand ce sera nécessaire)

1. **PgBouncer** en mode transaction devant Postgres (`DATABASE_PREPARE=false`).
2. **Read replica** pour les lectures du catalogue.
3. **Rate limit dans Redis** (il est aujourd'hui en mémoire, par instance).
4. **Partitionner `watched_episodes` par hash de `user_id`**. Inutile avant quelques centaines de millions de lignes :
   toutes les requêtes filtrent déjà sur `user_id`, donc le partitionnement sera transparent.
5. Notifications push (Web Push) pour les nouveaux épisodes, à partir du calendrier.

## Ce qui a tué TV Time, et ce qu'on fait différemment

- **Coût par user minimal** : catalogue mutualisé, images servies par le CDN TMDB, aucune agrégation
  à la lecture, JS léger. Un seul Postgres bien indexé encaisse des millions d'utilisateurs.
- **Licence TMDB** : l'API est gratuite pour un usage non commercial, avec attribution. Pour un service
  public monétisé (abonnement, pub), il faut une **licence commerciale TMDB**. À régler avant le lancement.
- **Monétisation dès le jour 1** : les utilisateurs de TV Time disaient qu'ils auraient payé. Garder le suivi
  de base gratuit (il ne coûte presque rien) et faire payer un abonnement pour les stats avancées,
  l'import/export, les notifications et les thèmes.

## Pistes suivantes

- Import de l'export RGPD de TV Time (CSV) et d'IMDb, sur le même modèle que Letterboxd
- Évaluation hors ligne sur de vraies données (rappel@k sur les derniers visionnages masqués)
- Notes et commentaires par épisode, amis et fil d'activité
- Export de ses données (JSON/CSV), suppression de compte
- Tests automatisés (Vitest sur `tracking.ts` avec une base Postgres de test)
