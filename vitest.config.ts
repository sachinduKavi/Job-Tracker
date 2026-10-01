import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Two test projects (see docs/development/testing.md):
 *  - unit:        pure functions, no I/O, run in parallel.
 *  - integration: real MySQL (TEST database from .env.test), run serially.
 */
const alias = {
  "@": path.resolve(__dirname),
  // The "server-only" guard throws outside React Server Components; tests run in plain Node.
  "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/support/integration-global-setup.ts"],
          setupFiles: ["tests/support/integration-setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
