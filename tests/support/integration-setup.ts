import { beforeEach } from "vitest";
import { loadTestEnv } from "./load-test-env";

loadTestEnv();

beforeEach(async () => {
  const { resetDatabase } = await import("./db");
  await resetDatabase();
});
