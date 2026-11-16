// npm run sync  — même job que POST /api/v1/cron/sync, en ligne de commande.
import { runDailySync } from "../src/lib/sync";
import { pg } from "../src/db";

runDailySync()
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pg.end());
