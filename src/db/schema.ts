/**
 * Schéma de données.
 *
 * Deux mondes séparés :
 *  1. CATALOGUE (shows, episodes, movies) : partagé par tous les utilisateurs,
 *     copié depuis TMDB une seule fois puis rafraîchi par diff (/changes).
 *     Les IDs sont ceux de TMDB (int4) : pas de table de correspondance.
 *  2. UTILISATEUR (users, user_shows, watched_episodes, user_movies) :
 *     tables étroites, clés composites, pas d'UUID, pas d'ID surrogate.
 *
 * Règles d'optimisation :
 *  - watched_episodes est LA table qui grossit (des milliards de lignes chez TV Time).
 *    => PK (user_id, show_id, episode_id) en int4 : ~50 octets/ligne, la PK sert
 *       d'index pour "tout ce que l'user a vu" ET "ce qu'il a vu de cette série".
 *  - Tout ce qui s'affiche souvent est dénormalisé et maintenu à l'écriture :
 *    progression (watched_count), prochain épisode (next_episode_id),
 *    totaux de stats sur users. Les lectures ne font jamais d'agrégat global.
 *  - Le statut est un smallint (2 octets) plutôt qu'un text.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────── CATALOGUE ───────────────────────────

export const shows = pgTable(
  "shows",
  {
    id: integer("id").primaryKey(), // = TMDB id
    name: text("name").notNull(),
    overview: text("overview"),
    posterPath: text("poster_path"), // chemin TMDB, l'image vient du CDN TMDB
    backdropPath: text("backdrop_path"),
    firstAirDate: date("first_air_date"),
    status: text("status"), // "Returning Series", "Ended", ...
    network: text("network"),
    genreIds: smallint("genre_ids").array().notNull().default(sql`'{}'`),
    episodeRuntime: smallint("episode_runtime"), // durée typique (fallback)
    seasonCount: smallint("season_count").notNull().default(0),
    // Épisodes déjà diffusés (saison > 0). Rafraîchi par le job quotidien.
    airedEpisodes: smallint("aired_episodes").notNull().default(0),
    popularity: real("popularity").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shows_popularity_idx").on(t.popularity)],
);

export const episodes = pgTable(
  "episodes",
  {
    id: integer("id").primaryKey(), // = TMDB episode id
    showId: integer("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    season: smallint("season").notNull(),
    number: smallint("number").notNull(),
    name: text("name"),
    overview: text("overview"),
    airDate: date("air_date"),
    runtime: smallint("runtime"),
    stillPath: text("still_path"),
  },
  (t) => [
    // Sert à : liste d'une série dans l'ordre + calcul du prochain épisode.
    uniqueIndex("episodes_show_order_idx").on(t.showId, t.season, t.number),
    // Sert au calendrier : WHERE show_id = ANY(...) AND air_date BETWEEN ...
    index("episodes_show_air_idx").on(t.showId, t.airDate),
    // Sert au job quotidien : "quels épisodes sont sortis hier ?"
    index("episodes_air_idx").on(t.airDate),
  ],
);

export const movies = pgTable("movies", {
  id: integer("id").primaryKey(), // = TMDB id
  title: text("title").notNull(),
  overview: text("overview"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  releaseDate: date("release_date"),
  runtime: smallint("runtime"),
  genreIds: smallint("genre_ids").array().notNull().default(sql`'{}'`),
  popularity: real("popularity").notNull().default(0),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────── UTILISATEURS ───────────────────────────

export const users = pgTable(
  "users",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(), // int4 : 2 milliards d'users, clés 2x plus petites qu'un bigint
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    // Compteurs de stats maintenus à l'écriture (jamais de COUNT(*) à la lecture).
    episodesWatched: integer("episodes_watched").notNull().default(0),
    episodeMinutes: integer("episode_minutes").notNull().default(0),
    moviesWatched: integer("movies_watched").notNull().default(0),
    movieMinutes: integer("movie_minutes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256 du token : un dump de la base ne permet pas de voler une session.
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** 0=en cours, 1=à voir, 2=terminée (à jour + série finie), 3=abandonnée */
export const ShowStatus = { watching: 0, planned: 1, completed: 2, stopped: 3 } as const;

export const userShows = pgTable(
  "user_shows",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    showId: integer("show_id")
      .notNull()
      .references(() => shows.id),
    status: smallint("status").notNull().default(ShowStatus.watching),
    favorite: boolean("favorite").notNull().default(false),
    rating: smallint("rating"), // 1..10 (= demi-étoiles sur 5), null = pas noté
    watchedCount: smallint("watched_count").notNull().default(0),
    // Premier épisode non vu (ordre saison/numéro, saisons > 0). NULL = à jour.
    nextEpisodeId: integer("next_episode_id"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    lastWatchedAt: timestamp("last_watched_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.showId] }),
    // Page "À suivre" triée par activité récente.
    index("user_shows_activity_idx").on(t.userId, t.lastWatchedAt.desc().nullsLast()),
    // Synchro catalogue : "qui suit cette série ?" (recalcul de next_episode_id).
    index("user_shows_show_idx").on(t.showId),
  ],
);

export const watchedEpisodes = pgTable(
  "watched_episodes",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    showId: integer("show_id").notNull(),
    episodeId: integer("episode_id").notNull(),
    watchedAt: timestamp("watched_at", { withTimezone: true }).notNull().defaultNow(),
    plays: smallint("plays").notNull().default(1), // revisionnages
  },
  // Pas de FK vers episodes : on évite un index + un check par insert sur la
  // table la plus écrite. La cohérence est garantie par l'INSERT ... SELECT.
  (t) => [primaryKey({ columns: [t.userId, t.showId, t.episodeId] })],
);

/** 0=à voir (watchlist), 1=vu */
export const MovieStatus = { watchlist: 0, watched: 1 } as const;

export const userMovies = pgTable(
  "user_movies",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id),
    status: smallint("status").notNull(),
    plays: smallint("plays").notNull().default(0),
    rating: smallint("rating"), // 1..10, null = pas noté
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    watchedAt: timestamp("watched_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.movieId] }),
    index("user_movies_list_idx").on(t.userId, t.status, t.addedAt.desc()),
  ],
);

/** Curseur de la synchro incrémentale TMDB (/tv/changes, /movie/changes). */
export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─────────────────────────── RECOMMANDATIONS ───────────────────────────

/** Type de titre dans les tables mixtes films/séries. */
export const Kind = { movie: 0, show: 1 } as const;
/** Origine d'un lien entre deux titres. */
export const LinkSource = { tmdb: 0, collab: 1 } as const;

/**
 * Fiche légère d'un titre candidat (affiche, genres, note TMDB).
 * Séparée de shows/movies : un candidat recommandé n'a pas besoin de ses
 * épisodes, et ensureShow() continue de considérer shows comme « complet ».
 */
export const mediaSummary = pgTable(
  "media_summary",
  {
    kind: smallint("kind").notNull(),
    id: integer("id").notNull(),
    title: text("title").notNull(),
    posterPath: text("poster_path"),
    year: smallint("year"),
    genreIds: smallint("genre_ids").array().notNull().default(sql`'{}'`),
    voteAverage: real("vote_average").notNull().default(0),
    voteCount: integer("vote_count").notNull().default(0),
    popularity: real("popularity").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.id] })],
);

/**
 * Graphe titre -> titres proches, partagé par tous les utilisateurs.
 *  - source tmdb   : /recommendations de TMDB (score = position dans la liste)
 *  - source collab : co-visionnage chez NOS utilisateurs (cosinus), recalculé la nuit.
 * Les liens peuvent traverser les types (film -> série).
 */
export const itemLinks = pgTable(
  "item_links",
  {
    srcKind: smallint("src_kind").notNull(),
    srcId: integer("src_id").notNull(),
    source: smallint("source").notNull(),
    dstKind: smallint("dst_kind").notNull(),
    dstId: integer("dst_id").notNull(),
    score: real("score").notNull(),
  },
  (t) => [primaryKey({ columns: [t.srcKind, t.srcId, t.source, t.dstKind, t.dstId] })],
);

/** Quand on a demandé les recommandations TMDB d'un titre (rafraîchi tous les 30 jours). */
export const linkFetches = pgTable(
  "link_fetches",
  {
    kind: smallint("kind").notNull(),
    id: integer("id").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.id] })],
);

/** « Pas pour moi » sur une recommandation : exclu ensuite, et signal négatif. */
export const userFeedback = pgTable(
  "user_feedback",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: smallint("kind").notNull(),
    itemId: integer("item_id").notNull(),
    value: smallint("value").notNull(), // -1 = pas intéressé
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.itemId] })],
);

// ─────────────────────────── IMPORTS ───────────────────────────

/**
 * Correspondance « titre|année » Letterboxd -> id TMDB, PARTAGÉE entre users :
 * un film populaire n'est cherché chez TMDB qu'une fois pour tout le monde.
 * movie_id NULL = introuvable (on ne recherche pas à chaque import).
 */
export const letterboxdMatches = pgTable("letterboxd_matches", {
  key: text("key").primaryKey(),
  movieId: integer("movie_id"),
  showId: integer("show_id"), // mini-série (Letterboxd en contient) : movie_id est alors NULL
  matchedAt: timestamp("matched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 0=en attente, 1=en cours, 2=terminé, 3=échec */
export const ImportStatus = { pending: 0, running: 1, done: 2, failed: 3 } as const;

export const imports = pgTable(
  "imports",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // "letterboxd"
    status: smallint("status").notNull().default(ImportStatus.pending),
    total: integer("total").notNull(),
    processed: integer("processed").notNull().default(0),
    matched: integer("matched").notNull().default(0),
    // Bail : un seul worker traite l'import ; s'il meurt, un autre reprend après expiration.
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("imports_user_idx").on(t.userId, t.createdAt.desc())],
);

/** 0=à traiter, 1=film trouvé, 2=introuvable, 3=c'est une série (non importée, proposée à l'utilisateur) */
export const ImportItemState = { pending: 0, matched: 1, notFound: 2, show: 3 } as const;

export const importItems = pgTable(
  "import_items",
  {
    importId: integer("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    name: text("name").notNull(),
    year: smallint("year"),
    watched: boolean("watched").notNull(), // false = watchlist seulement
    watchedAt: date("watched_at"),
    rating: smallint("rating"),
    plays: smallint("plays").notNull().default(1),
    movieId: integer("movie_id"),
    showId: integer("show_id"),
    state: smallint("state").notNull().default(ImportItemState.pending),
  },
  (t) => [primaryKey({ columns: [t.importId, t.idx] })],
);
