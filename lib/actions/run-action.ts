import "server-only";
import { requireAuth } from "@/lib/auth/session";
import { isAppError, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Wraps a Server Action body: enforces authentication, converts domain errors into
 * typed `ActionResult` failures and hides unexpected errors behind a generic message.
 * Keeps each action file to: authenticate → validate → call service → revalidate.
 */
export async function runAction<T>(
  name: string,
  fn: () => Promise<ActionResult<T>>,
  options: { requireAuth?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    if (options.requireAuth !== false) await requireAuth();
    return await fn();
  } catch (error) {
    if (isAppError(error)) {
      if (error.code !== "VALIDATION") logger.warn(`action.${name}.failed`, { code: error.code, message: error.message });
      return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors };
    }
    logger.error(`action.${name}.error`, error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
