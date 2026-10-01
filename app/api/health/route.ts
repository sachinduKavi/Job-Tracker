import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/** Liveness + database readiness probe for uptime monitoring (public, no data exposed). */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok", time: new Date().toISOString() });
  } catch (error) {
    logger.error("health.database_unreachable", { error: String(error) });
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
