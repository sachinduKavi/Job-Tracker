import { z } from "zod";

/**
 * Shared validation helpers. These are pure and run on both the client
 * (React Hook Form resolver) and the server (Server Actions re-validate everything).
 */

const EMAIL_SCHEMA = z.email();

/** Splits a comma/semicolon/newline separated list of addresses into trimmed, de-duplicated entries. */
export function parseEmailList(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[,;\n]/)) {
    const email = raw.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_SCHEMA.safeParse(value).success;
}

/** Optional string field: trims and limits length; empty string allowed. */
export const optionalText = (max: number) => z.string().trim().max(max, `Must be at most ${max} characters`);

export const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`);

export const optionalEmail = z
  .string()
  .trim()
  .max(320)
  .refine((v) => v === "" || isValidEmail(v), "Enter a valid email address");

/** Comma-separated email list; every entry must be a valid address. Max 20 entries. */
export const emailList = z
  .string()
  .trim()
  .max(5000)
  .superRefine((value, ctx) => {
    const emails = parseEmailList(value);
    if (emails.length > 20) ctx.addIssue({ code: "custom", message: "At most 20 addresses allowed" });
    const invalid = emails.filter((e) => !isValidEmail(e));
    if (invalid.length > 0) ctx.addIssue({ code: "custom", message: `Invalid address: ${invalid.join(", ")}` });
  });

export const optionalHttpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    if (v === "") return true;
    try {
      const url = new URL(v);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid http(s) URL");

/** YYYY-MM-DD date string or empty. */
export const optionalDateString = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Enter a valid date");

/** Parses YYYY-MM-DD into a UTC-midnight Date (stored in a DATE column). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formats a Date to YYYY-MM-DD (UTC) for date inputs. */
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** Converts a Zod error into a flat `{ field: message }` map for forms. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
