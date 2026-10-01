import { execSync } from "node:child_process";
import { loadTestEnv } from "../support/load-test-env";

/**
 * Migrates and empties the test database before the E2E run. The reset runs through
 * tsx because Playwright loads TypeScript as CommonJS and the Prisma client is ESM.
 */
export default async function globalSetup() {
  loadTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
  execSync("npx tsx tests/support/reset-db.ts", { stdio: "inherit", env: process.env });
}
