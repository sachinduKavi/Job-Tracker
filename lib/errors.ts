/**
 * Domain errors thrown by the service layer (lib/**). Server Actions translate them
 * into user-facing `ActionResult` failures; unexpected errors are logged and reported
 * with a generic message so internals (and secrets) never reach the client.
 */
export type AppErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "DUPLICATE_SEND"
  | "EMAIL_SEND_FAILED"
  | "CONFIGURATION"
  | "UNAUTHORIZED";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: AppErrorCode; fieldErrors?: Record<string, string> };
