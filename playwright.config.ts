import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

/**
 * End-to-end tests (docs/development/testing.md#end-to-end-tests).
 * Starts `next dev` against the TEST database with EMAIL_TRANSPORT=mock, so the full
 * UI → Server Action → service → database flow runs without sending real email.
 */
const testEnv = config({ path: path.resolve(__dirname, ".env.test"), processEnv: {}, quiet: true }).parsed ?? {};
const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: { ...testEnv, NODE_ENV: "development" },
  },
});
