import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Creates a Prisma client for a MySQL connection URL.
 *
 * Prisma 7 talks to MySQL through a driver adapter (`@prisma/adapter-mariadb`, which
 * is wire-compatible with MySQL 8). Kept free of "server-only" so the seed script and
 * test tooling can use it; application code should import `db` from lib/db.ts.
 */
export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    connectionLimit: 5,
    connectTimeout: 10_000,
    // MySQL 8 defaults to caching_sha2_password; allow the RSA key exchange over non-TLS.
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}
