// npm run catalog:backfill-votes — complète les votes TMDB manquants (fait aussi par le job quotidien, par lots).
import { closeDb } from "../src/db";
import { backfillVotes } from "../src/lib/sync";

backfillVotes({ movies: 5000, shows: 500 })
  .then((r) => console.log(r))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
