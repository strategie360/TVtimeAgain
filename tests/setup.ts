import { inject } from "vitest";

// Doit être défini avant le premier import de src/db (qui lit DATABASE_URL au chargement).
process.env.DATABASE_URL = inject("databaseUrl");
process.env.DATABASE_POOL_MAX = "4";
process.env.TMDB_TOKEN = "test-token"; // tmdb.ts exige un token ; fetch est simulé dans les tests
