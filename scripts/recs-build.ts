// npm run recs:build — recalcule les liens de co-visionnage (aussi fait par le job quotidien).
import { buildCollabLinks } from "../src/lib/recs";
import { closeDb } from "../src/db";

console.time("collab");
buildCollabLinks()
  .then((r) => console.log(r))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    console.timeEnd("collab");
    return closeDb();
  });
