import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getServerEnv } from "@/lib/env";

/**
 * Local filesystem storage backend for uploaded documents.
 *
 * Files are stored outside `public/` and are only reachable through the authenticated
 * download route (/api/documents/[id]/download). Keys are random UUIDs, never
 * user-supplied names, so they cannot collide or traverse directories.
 *
 * The interface (put/get/remove by key) is intentionally small so an S3 backend can
 * replace it later (see docs/features/documents.md#storage-strategy).
 */

function root(): string {
  // Runtime-configured directory; excluded from build-time file tracing on purpose.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), getServerEnv().STORAGE_DIR);
}

function resolveKey(key: string): string {
  if (!/^[a-z0-9/.-]+$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  const base = root();
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putObject(bytes: Uint8Array, extension: string): Promise<string> {
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}${extension}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: "wx" });
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function removeObject(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}
