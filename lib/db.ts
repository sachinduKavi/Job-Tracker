import "server-only";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";

/**
 * Prisma client singleton for application code.
 *
 * In development, Next.js hot reload re-evaluates modules, so the client is cached on
 * `globalThis` to avoid exhausting connections. Only server-side modules under lib/
 * may import this file (see docs/architecture/application-architecture.md).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
}

/**
 * Lazily-initialised client: the connection is created on first use, so importing
 * this module during `next build` does not require DATABASE_URL.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
