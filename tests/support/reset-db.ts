/** CLI wrapper used by the Playwright global setup: `npx tsx tests/support/reset-db.ts`. */
import { loadTestEnv } from "./load-test-env";
import { resetDatabase } from "./db";

loadTestEnv();
resetDatabase()
  .then(() => console.log("Test database reset."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
