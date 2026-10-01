import "server-only";
import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * Parsed lazily (on first use) so `next build` does not require runtime secrets.
 * This module imports "server-only": importing it from a Client Component fails the
 * build, which guarantees secrets never reach the browser bundle.
 *
 * Every variable is documented in docs/setup/environment-variables.md.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Authentication (single-user)
  APP_PASSWORD: z.string().min(8, "APP_PASSWORD must be at least 8 characters"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),

  // Amazon SES. Credentials are optional here because the AWS SDK default credential
  // chain (env vars, shared config, IAM role) resolves them.
  AWS_REGION: z.string().min(1).default("us-east-1"),
  SES_FROM_EMAIL: z.string().default(""),
  SES_FROM_NAME: z.string().default(""),
  SES_REPLY_TO: z.string().default(""),
  SES_CONFIGURATION_SET: z.string().default(""),
  /** When set, SNS notifications from any other topic are rejected. */
  SES_SNS_TOPIC_ARN: z.string().default(""),

  /** "ses" sends real email; "mock" is for local development and automated tests only. */
  EMAIL_TRANSPORT: z.enum(["ses", "mock"]).default("ses"),
  EMAIL_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(20),

  STORAGE_DIR: z.string().default("./storage/uploads"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only variable names and messages are logged — never values.
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment configuration: ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.EMAIL_TRANSPORT === "mock") {
    throw new Error("EMAIL_TRANSPORT=mock is not allowed in production");
  }
  cached = parsed.data;
  return cached;
}

/** Test seam: forget the cached configuration so tests can change process.env. */
export function resetServerEnvForTesting() {
  cached = undefined;
}
