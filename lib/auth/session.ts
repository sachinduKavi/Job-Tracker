import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken, verifySessionToken } from "@/lib/auth/token";

/**
 * Session helpers for Server Components and Server Actions.
 *
 * proxy.ts redirects unauthenticated page requests, but Server Actions are reachable by
 * direct POST, so every action must also call `requireAuth()` (defence in depth, per
 * the Next.js data-security guidance).
 */

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, getServerEnv().SESSION_SECRET);
}

export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) throw new AppError("UNAUTHORIZED", "Your session has expired. Please sign in again.");
}

export async function startSession(): Promise<void> {
  const env = getServerEnv();
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(env.SESSION_SECRET), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** For Server Components: redirects to /login when the session is missing or expired. */
export async function requirePageAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}
