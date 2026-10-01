import { execSync } from "node:child_process";
import { loadTestEnv } from "./load-test-env";

/** Applies all migrations to the test database once per run. */
export default function setup() {
  loadTestEnv();
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
