"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, startSession } from "@/lib/auth/session";
import { passwordMatches } from "@/lib/auth/token";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Login / logout. Brute force is slowed by a per-IP in-memory limiter
 * (5 failed attempts per 15 minutes). In-memory is sufficient for a single-instance,
 * single-user deployment; see docs/architecture/security.md#authentication.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; first: number }>();

function isBlocked(ip: string, now: number) {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (now - entry.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string, now: number) {
  const entry = failures.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) failures.set(ip, { count: 1, first: now });
  else entry.count += 1;
}

export interface LoginState {
  error?: string;
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  // Only allow same-site relative paths (prevents open redirects).
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const now = Date.now();
  if (isBlocked(ip, now)) return { error: "Too many failed attempts. Try again in 15 minutes." };

  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0 || password.length > 200) {
    return { error: "Enter your password" };
  }
  if (!(await passwordMatches(password, getServerEnv().APP_PASSWORD))) {
    recordFailure(ip, now);
    logger.warn("auth.login_failed", { ip });
    return { error: "Incorrect password" };
  }
  failures.delete(ip);
  await startSession();
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
