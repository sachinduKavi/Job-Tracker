import path from "node:path";
import { config } from "dotenv";

/** Loads .env.test (overriding anything inherited) and refuses non-test databases. */
export function loadTestEnv() {
  config({ path: path.resolve(__dirname, "../../.env.test"), override: true, quiet: true });
  const url = process.env.DATABASE_URL ?? "";
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(`Refusing to run tests: DATABASE_URL must point at a *_test database (got ${url.replace(/\/\/[^@]*@/, "//***@")})`);
  }
  (process.env as Record<string, string>).NODE_ENV = "test";
}
