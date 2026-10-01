/**
 * Minimal structured logger (JSON lines on stdout/stderr — picked up by any log
 * collector). Context objects are passed through `redact` so credentials, tokens and
 * email bodies never reach logs. See docs/deployment/production.md#logging.
 */
const SENSITIVE_KEY = /(password|secret|token|authorization|cookie|accesskey|credential|body|html|text)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  }
  return out;
}

function serializeError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { message: String(error) };
}

function write(level: "info" | "warn" | "error", event: string, context?: unknown) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const entry = {
    level,
    time: new Date().toISOString(),
    event,
    ...(context instanceof Error ? { error: serializeError(context) } : context ? { context: redact(context) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, context?: unknown) => write("info", event, context),
  warn: (event: string, context?: unknown) => write("warn", event, context),
  error: (event: string, context?: unknown) => write("error", event, context),
};
